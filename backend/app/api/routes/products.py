from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminUser, CurrentUser, Db
from app.core.config import settings
from app.models import Product, StockMovement
from app.schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    StockAdjustIn,
    StockMovementOut,
)

router = APIRouter(prefix="/products", tags=["products"])

MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2 MB


def _detect_image_ext(head: bytes) -> str | None:
    """Detecta el formato real por bytes mágicos (no confía en el content-type)."""
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def _barcode_taken(db: Db, barcode: str, exclude_id: int | None = None) -> bool:
    stmt = select(Product).where(Product.barcode == barcode)
    if exclude_id is not None:
        stmt = stmt.where(Product.id != exclude_id)
    return db.scalar(stmt) is not None


@router.get("", response_model=list[ProductOut])
def list_products(
    db: Db,
    _: CurrentUser,
    q: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=80),
    include_inactive: bool = False,
    low_stock: bool = False,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    stmt = select(Product)
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            Product.name.ilike(pattern) | Product.sku.ilike(pattern) | Product.barcode.ilike(pattern)
        )
    if category:
        stmt = stmt.where(Product.category == category)
    if low_stock:
        stmt = stmt.where(Product.stock <= Product.min_stock)
    stmt = stmt.order_by(Product.name).limit(limit).offset(offset)
    return db.scalars(stmt).all()


@router.post("", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, db: Db, user: AdminUser):
    if data.barcode and _barcode_taken(db, data.barcode):
        raise HTTPException(
            status_code=409, detail=f"Ya existe un producto con el código de barras {data.barcode}"
        )
    product = Product(**data.model_dump())
    db.add(product)
    try:
        db.flush()
        if product.stock > 0:
            db.add(
                StockMovement(
                    product_id=product.id,
                    qty_delta=product.stock,
                    reason="initial",
                    note="Stock inicial",
                    user_id=user.id,
                )
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Ya existe un producto con el SKU {data.sku}")
    db.refresh(product)
    return product


@router.get("/barcode/{code}", response_model=ProductOut)
def get_product_by_barcode(code: str, db: Db, _: CurrentUser):
    """Búsqueda exacta por código de barras (lector USB); respaldo por SKU."""
    product = db.scalar(select(Product).where(Product.barcode == code))
    if product is None:
        product = db.scalar(select(Product).where(Product.sku == code))
    if product is None:
        raise HTTPException(status_code=404, detail=f"Ningún producto con el código {code}")
    return product


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Db, _: CurrentUser):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductUpdate, db: Db, _: AdminUser):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    payload = data.model_dump(exclude_unset=True)
    new_barcode = payload.get("barcode")
    if new_barcode and _barcode_taken(db, new_barcode, exclude_id=product_id):
        raise HTTPException(
            status_code=409, detail=f"Ya existe un producto con el código de barras {new_barcode}"
        )
    for key, value in payload.items():
        setattr(product, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="SKU duplicado")
    db.refresh(product)
    return product


@router.post("/{product_id}/image", response_model=ProductOut)
async def upload_product_image(product_id: int, db: Db, _: AdminUser, file: UploadFile = File(...)):
    """Sube la foto del producto (JPG/PNG/WebP, máx. 2 MB). Reemplaza la anterior si existe."""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 2 MB")
    ext = _detect_image_ext(content[:16])
    if ext is None:
        raise HTTPException(status_code=400, detail="Formato no permitido: usa JPG, PNG o WebP")
    folder = Path(settings.uploads_dir) / "products"
    folder.mkdir(parents=True, exist_ok=True)
    if product.image_url:
        (folder / product.image_url.rsplit("/", 1)[-1]).unlink(missing_ok=True)
    filename = f"{product.id}-{uuid4().hex[:10]}.{ext}"
    (folder / filename).write_bytes(content)
    product.image_url = f"/uploads/products/{filename}"
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/stock-adjust", response_model=ProductOut)
def adjust_stock(product_id: int, data: StockAdjustIn, db: Db, user: AdminUser):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    new_stock = product.stock + data.qty_delta
    if new_stock < 0:
        raise HTTPException(
            status_code=409,
            detail=f"Stock insuficiente: disponible {product.stock}",
        )
    product.stock = new_stock
    db.add(
        StockMovement(
            product_id=product.id,
            qty_delta=data.qty_delta,
            reason=data.reason,
            note=data.note,
            user_id=user.id,
        )
    )
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}/movements", response_model=list[StockMovementOut])
def product_movements(
    product_id: int,
    db: Db,
    _: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
):
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    stmt = (
        select(StockMovement)
        .where(StockMovement.product_id == product_id)
        .order_by(StockMovement.id.desc())
        .limit(limit)
    )
    return db.scalars(stmt).all()
