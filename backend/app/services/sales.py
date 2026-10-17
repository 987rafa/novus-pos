"""Lógica de negocio de ventas: creación con descuento de stock y anulación con reposición."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.models import Customer, Product, Sale, SaleItem, StockMovement, User
from app.schemas.sale import SaleCreate


class SaleError(Exception):
    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def create_sale(db: Session, cashier: User, data: SaleCreate) -> Sale:
    merged: dict[int, int] = {}
    for item in data.items:
        merged[item.product_id] = merged.get(item.product_id, 0) + item.qty

    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(list(merged))))}
    missing = sorted(set(merged) - set(products))
    if missing:
        raise SaleError(f"Producto no encontrado: {missing}", 404)

    if data.customer_id is not None and db.get(Customer, data.customer_id) is None:
        raise SaleError("Cliente no encontrado", 404)

    sale = Sale(user_id=cashier.id, customer_id=data.customer_id, status="completed")
    subtotal = 0
    for product_id, qty in merged.items():
        product = products[product_id]
        if not product.is_active:
            raise SaleError(f"El producto {product.name} está inactivo")
        if product.stock < qty:
            raise SaleError(f"Stock insuficiente para {product.name} (disponible: {product.stock})")
        line_total = product.price_cents * qty
        sale.items.append(
            SaleItem(
                product_id=product.id,
                product_name=product.name,
                qty=qty,
                unit_price_cents=product.price_cents,
                line_total_cents=line_total,
            )
        )
        product.stock -= qty
        db.add(StockMovement(product_id=product.id, qty_delta=-qty, reason="sale", user_id=cashier.id))
        subtotal += line_total

    discount = min(data.discount_cents, subtotal)
    taxable = subtotal - discount
    tax = round(taxable * settings.tax_rate)
    sale.subtotal_cents = subtotal
    sale.discount_cents = discount
    sale.tax_cents = tax
    sale.total_cents = taxable + tax

    sale.payment_method = data.payment_method
    if data.payment_method == "cash" and data.cash_received_cents is not None:
        if data.cash_received_cents < sale.total_cents:
            raise SaleError("El efectivo recibido no alcanza el total de la venta", 400)
        sale.cash_received_cents = data.cash_received_cents
        sale.change_cents = data.cash_received_cents - sale.total_cents

    db.add(sale)
    db.commit()
    db.refresh(sale)
    return sale


def void_sale(db: Session, sale: Sale, user: User) -> Sale:
    if sale.status != "completed":
        raise SaleError("Esta venta ya fue anulada", 400)
    for item in sale.items:
        product = db.get(Product, item.product_id)
        if product is not None:
            product.stock += item.qty
            db.add(
                StockMovement(
                    product_id=product.id,
                    qty_delta=item.qty,
                    reason="sale_void",
                    note=f"Anulación venta #{sale.id}",
                    user_id=user.id,
                )
            )
    sale.status = "voided"
    sale.voided_at = utcnow()
    db.commit()
    db.refresh(sale)
    return sale
