from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select

from app.api.deps import CurrentUser, Db, require_orders_key
from app.models import Order, Product
from app.schemas.order import (
    CatalogItemOut,
    OrderConfirm,
    OrderCreate,
    OrderItemOut,
    OrderListOut,
    OrderOut,
    OrderReject,
)
from app.services.orders import OrderError, confirm_order, create_order, reject_order
from app.services.sales import SaleError

router = APIRouter(prefix="/orders", tags=["orders"])


def order_to_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        status=order.status,
        channel=order.channel,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        note=order.note,
        created_at=order.created_at,
        confirmed_at=order.confirmed_at,
        rejected_at=order.rejected_at,
        rejected_reason=order.rejected_reason,
        sale_id=order.sale_id,
        subtotal_cents=order.subtotal_cents,
        tax_cents=order.tax_cents,
        total_cents=order.total_cents,
        items=[OrderItemOut.model_validate(item) for item in order.items],
    )


@router.get("/catalog", response_model=list[CatalogItemOut])
def catalog(db: Db, _: None = Depends(require_orders_key)):
    """Catálogo para canales externos (WhatsApp/web): productos activos con precio y stock."""
    products = db.scalars(select(Product).where(Product.is_active.is_(True)).order_by(Product.name)).all()
    return [
        CatalogItemOut(id=p.id, name=p.name, category=p.category, price_cents=p.price_cents, stock=p.stock)
        for p in products
    ]


@router.post("", response_model=OrderOut, status_code=201)
def register_order(data: OrderCreate, db: Db, _: None = Depends(require_orders_key)):
    """Crea un pedido pendiente (canal externo). El stock se descuenta al confirmarlo en caja."""
    try:
        order = create_order(db, data)
    except OrderError as err:
        db.rollback()
        raise HTTPException(status_code=err.status_code, detail=err.message)
    return order_to_out(order)


@router.get("", response_model=OrderListOut)
def list_orders(
    db: Db,
    _: CurrentUser,
    status: str | None = Query(default=None, max_length=20),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    filters = []
    if status:
        filters.append(Order.status == status)

    count_stmt = select(func.count(Order.id))
    list_stmt = select(Order).order_by(Order.id.desc()).limit(limit).offset(offset)
    for condition in filters:
        count_stmt = count_stmt.where(condition)
        list_stmt = list_stmt.where(condition)

    total = db.scalar(count_stmt) or 0
    orders = db.scalars(list_stmt).all()
    return OrderListOut(total=total, items=[order_to_out(order) for order in orders])


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Db, _: CurrentUser):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return order_to_out(order)


@router.post("/{order_id}/confirm", response_model=OrderOut)
def confirm(order_id: int, data: OrderConfirm, db: Db, user: CurrentUser):
    """Confirma el pedido: registra la venta, descuenta stock y lo vincula a la venta."""
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    try:
        order = confirm_order(db, order, user, data)
    except (OrderError, SaleError) as err:
        db.rollback()
        raise HTTPException(status_code=err.status_code, detail=err.message)
    return order_to_out(order)


@router.post("/{order_id}/reject", response_model=OrderOut)
def reject(order_id: int, data: OrderReject, db: Db, _: CurrentUser):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    try:
        order = reject_order(db, order, data.reason)
    except OrderError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)
    return order_to_out(order)
