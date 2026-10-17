from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow


class Product(Base):
    """Producto del catálogo. Los precios se guardan en centavos (enteros) para evitar errores de redondeo."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    barcode: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)  # EAN-13/UPC (escáner)
    name: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str] = mapped_column(String(80), default="General", index=True)
    image_url: Mapped[str | None] = mapped_column(String(255))  # foto del producto
    price_cents: Mapped[int] = mapped_column(Integer)  # precio de venta
    cost_cents: Mapped[int] = mapped_column(Integer, default=0)  # costo (para margen)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=5)  # alerta de stock bajo
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class StockMovement(Base):
    """Movimiento de inventario — historial auditable de cada entrada/salida de stock."""

    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    qty_delta: Mapped[int] = mapped_column(Integer)  # +entrada / −salida
    reason: Mapped[str] = mapped_column(String(40))  # initial | purchase | adjustment | sale | sale_void
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
