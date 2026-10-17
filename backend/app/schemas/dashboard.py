from pydantic import BaseModel


class SummaryOut(BaseModel):
    sales_today_cents: int
    sales_today_count: int
    sales_month_cents: int
    sales_month_count: int
    products_count: int
    low_stock_count: int
    customers_count: int


class SeriesPoint(BaseModel):
    date: str
    total_cents: int
    count: int


class SalesSeriesOut(BaseModel):
    days: int
    points: list[SeriesPoint]


class TopProduct(BaseModel):
    product_id: int
    name: str
    qty: int
    total_cents: int


class TopProductsOut(BaseModel):
    items: list[TopProduct]


class LowStockItem(BaseModel):
    product_id: int
    name: str
    stock: int
    min_stock: int
