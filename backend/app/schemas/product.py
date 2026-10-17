from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=40)
    barcode: str | None = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(default="General", max_length=80)
    price_cents: int = Field(ge=0)
    cost_cents: int = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
    min_stock: int = Field(default=5, ge=0)

    @field_validator("barcode")
    @classmethod
    def barcode_normalizado(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=1, max_length=40)
    barcode: str | None = Field(default=None, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, max_length=80)
    price_cents: int | None = Field(default=None, ge=0)
    cost_cents: int | None = Field(default=None, ge=0)
    min_stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None

    @field_validator("barcode")
    @classmethod
    def barcode_normalizado(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    barcode: str | None
    name: str
    category: str
    image_url: str | None
    price_cents: int
    cost_cents: int
    stock: int
    min_stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StockAdjustIn(BaseModel):
    qty_delta: int
    reason: str = Field(default="adjustment", max_length=40)
    note: str | None = Field(default=None, max_length=255)

    @field_validator("qty_delta")
    @classmethod
    def qty_not_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("qty_delta no puede ser cero")
        return value


class StockMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    qty_delta: int
    reason: str
    note: str | None
    user_id: int | None
    created_at: datetime
