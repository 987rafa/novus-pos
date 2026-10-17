from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.customer import CustomerBrief


class SaleItemIn(BaseModel):
    product_id: int
    qty: int = Field(gt=0)


class SaleCreate(BaseModel):
    customer_id: int | None = None
    discount_cents: int = Field(default=0, ge=0)
    items: list[SaleItemIn] = Field(min_length=1)


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str
    qty: int
    unit_price_cents: int
    line_total_cents: int


class SaleOut(BaseModel):
    id: int
    status: str
    created_at: datetime
    voided_at: datetime | None
    cashier_name: str | None
    customer: CustomerBrief | None
    subtotal_cents: int
    discount_cents: int
    tax_cents: int
    total_cents: int
    items: list[SaleItemOut]


class SaleListOut(BaseModel):
    total: int
    items: list[SaleOut]
