from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminUser, CurrentUser, Db
from app.models import Product, StockMovement
from app.schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    StockAdjustIn,
    StockMovementOut,
)

router = APIRouter(prefix="/products", tags=["products"])


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
        stmt = stmt.where(Product.name.ilike(pattern) | Product.sku.ilike(pattern))
    if category:
        stmt = stmt.where(Product.category == category)
    if low_stock:
        stmt = stmt.where(Product.stock <= Product.min_stock)
    stmt = stmt.order_by(Product.name).limit(limit).offset(offset)
    return db.scalars(stmt).all()


@router.post("", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, db: Db, user: AdminUser):
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
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="SKU duplicado")
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
