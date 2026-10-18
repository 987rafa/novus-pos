from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class OrderItemIn(BaseModel):
    product_id: int
    qty: int = Field(gt=0)


class OrderCreate(BaseModel):
    channel: Literal["whatsapp", "web", "mostrador"] = "whatsapp"
    customer_name: str = Field(default="Cliente", max_length=120)
    customer_phone: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=255)
    items: list[OrderItemIn] = Field(min_length=1)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str
    qty: int
    unit_price_cents: int
    line_total_cents: int


class OrderOut(BaseModel):
    id: int
    status: str
    channel: str
    customer_name: str
    customer_phone: str | None
    note: str | None
    created_at: datetime
    confirmed_at: datetime | None
    rejected_at: datetime | None
    rejected_reason: str | None
    sale_id: int | None
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    items: list[OrderItemOut]


class OrderListOut(BaseModel):
    total: int
    items: list[OrderOut]


class OrderConfirm(BaseModel):
    payment_method: Literal["cash", "transfer", "card"] = "cash"
    cash_received_cents: int | None = Field(default=None, ge=0)


class OrderReject(BaseModel):
    reason: str | None = Field(default=None, max_length=255)


class CatalogItemOut(BaseModel):
    """Producto del catálogo público que usan los canales externos (WhatsApp/web) para armar pedidos."""

    id: int
    name: str
    category: str
    price_cents: int
    stock: int
