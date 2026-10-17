from datetime import datetime

from pydantic import BaseModel, Field


class CashOpenIn(BaseModel):
    opening_cents: int = Field(default=0, ge=0)


class CashCloseIn(BaseModel):
    counted_cents: int = Field(ge=0)
    note: str | None = Field(default=None, max_length=255)


class CashSessionOut(BaseModel):
    id: int
    status: str
    opened_by_name: str
    opened_at: datetime
    opening_cents: int
    closed_by_name: str | None = None
    closed_at: datetime | None = None
    expected_cents: int | None = None
    counted_cents: int | None = None
    difference_cents: int | None = None
    note: str | None = None


class CashStatusOut(BaseModel):
    is_open: bool
    session: CashSessionOut | None = None
    cash_sales_cents: int = 0  # ventas en efectivo del turno (anuladas restan)
    cash_sales_count: int = 0
    expected_cents: int = 0  # base inicial + ventas en efectivo
