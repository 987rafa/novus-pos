"""Lógica de pedidos entrantes: creación desde canales externos, confirmación (→ venta) y rechazo.

El stock NO se descuenta al crear el pedido (solo se valida); se descuenta al confirmarlo,
cuando el pedido se convierte en una venta normal de caja (con su movimiento de inventario).
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.models import Order, OrderItem, Product, User
from app.schemas.order import OrderConfirm, OrderCreate
from app.schemas.sale import SaleCreate, SaleItemIn
from app.services.sales import create_sale


class OrderError(Exception):
    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def create_order(db: Session, data: OrderCreate) -> Order:
    merged: dict[int, int] = {}
    for item in data.items:
        merged[item.product_id] = merged.get(item.product_id, 0) + item.qty

    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(list(merged))))}
    missing = sorted(set(merged) - set(products))
    if missing:
        raise OrderError(f"Producto no encontrado: {missing}", 404)

    order = Order(
        status="pending",
        channel=data.channel,
        customer_name=data.customer_name.strip() or "Cliente",
        customer_phone=data.customer_phone,
        note=data.note,
    )
    subtotal = 0
    for product_id, qty in merged.items():
        product = products[product_id]
        if not product.is_active:
            raise OrderError(f"El producto {product.name} está inactivo")
        if product.stock < qty:
            raise OrderError(f"Stock insuficiente para {product.name} (disponible: {product.stock})")
        line_total = product.price_cents * qty
        order.items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                qty=qty,
                unit_price_cents=product.price_cents,
                line_total_cents=line_total,
            )
        )
        subtotal += line_total

    order.subtotal_cents = subtotal
    order.tax_cents = round(subtotal * settings.tax_rate)
    order.total_cents = subtotal + order.tax_cents

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def confirm_order(db: Session, order: Order, cashier: User, data: OrderConfirm) -> Order:
    """Convierte el pedido en venta (descuenta stock) y lo marca como confirmado."""
    if order.status != "pending":
        raise OrderError("Este pedido ya fue procesado", 400)

    sale = create_sale(
        db,
        cashier,
        SaleCreate(
            payment_method=data.payment_method,
            cash_received_cents=data.cash_received_cents,
            items=[SaleItemIn(product_id=item.product_id, qty=item.qty) for item in order.items],
        ),
    )

    order.status = "confirmed"
    order.sale_id = sale.id
    order.confirmed_at = utcnow()
    db.commit()
    db.refresh(order)
    return order


def reject_order(db: Session, order: Order, reason: str | None) -> Order:
    if order.status != "pending":
        raise OrderError("Este pedido ya fue procesado", 400)
    order.status = "rejected"
    order.rejected_at = utcnow()
    order.rejected_reason = reason
    db.commit()
    db.refresh(order)
    return order
