from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import CurrentUser, Db
from app.models import Customer, Product, Sale, SaleItem
from app.schemas.dashboard import (
    LowStockItem,
    SalesSeriesOut,
    SeriesPoint,
    SummaryOut,
    TopProduct,
    TopProductsOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _utc_day_start(moment: datetime) -> datetime:
    return datetime.combine(moment.date(), time.min, tzinfo=timezone.utc)


@router.get("/summary", response_model=SummaryOut)
def summary(db: Db, _: CurrentUser):
    now = datetime.now(timezone.utc)
    today = _utc_day_start(now)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    today_sales = db.execute(
        select(func.coalesce(func.sum(Sale.total_cents), 0), func.count(Sale.id)).where(
            Sale.status == "completed", Sale.created_at >= today
        )
    ).one()
    month_sales = db.execute(
        select(func.coalesce(func.sum(Sale.total_cents), 0), func.count(Sale.id)).where(
            Sale.status == "completed", Sale.created_at >= month_start
        )
    ).one()
    products_count = db.scalar(select(func.count(Product.id)).where(Product.is_active.is_(True))) or 0
    low_stock_count = (
        db.scalar(
            select(func.count(Product.id)).where(
                Product.is_active.is_(True), Product.stock <= Product.min_stock
            )
        )
        or 0
    )
    customers_count = db.scalar(select(func.count(Customer.id))) or 0

    return SummaryOut(
        sales_today_cents=int(today_sales[0]),
        sales_today_count=int(today_sales[1]),
        sales_month_cents=int(month_sales[0]),
        sales_month_count=int(month_sales[1]),
        products_count=products_count,
        low_stock_count=low_stock_count,
        customers_count=customers_count,
    )


@router.get("/sales-series", response_model=SalesSeriesOut)
def sales_series(db: Db, _: CurrentUser, days: int = Query(default=14, ge=1, le=90)):
    now = datetime.now(timezone.utc)
    start_day = _utc_day_start(now) - timedelta(days=days - 1)

    rows = db.execute(
        select(Sale.created_at, Sale.total_cents).where(
            Sale.status == "completed", Sale.created_at >= start_day
        )
    ).all()

    buckets: dict[str, dict[str, int]] = {}
    for offset in range(days):
        key = (start_day + timedelta(days=offset)).date().isoformat()
        buckets[key] = {"total_cents": 0, "count": 0}
    for created_at, total_cents in rows:
        key = created_at.date().isoformat()
        if key in buckets:
            buckets[key]["total_cents"] += int(total_cents)
            buckets[key]["count"] += 1

    return SalesSeriesOut(
        days=days,
        points=[SeriesPoint(date=key, **values) for key, values in buckets.items()],
    )


@router.get("/top-products", response_model=TopProductsOut)
def top_products(
    db: Db,
    _: CurrentUser,
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=5, ge=1, le=20),
):
    start = _utc_day_start(datetime.now(timezone.utc)) - timedelta(days=days - 1)
    rows = db.execute(
        select(
            SaleItem.product_id,
            SaleItem.product_name,
            func.sum(SaleItem.qty),
            func.sum(SaleItem.line_total_cents),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(Sale.status == "completed", Sale.created_at >= start)
        .group_by(SaleItem.product_id, SaleItem.product_name)
        .order_by(func.sum(SaleItem.line_total_cents).desc())
        .limit(limit)
    ).all()
    return TopProductsOut(
        items=[
            TopProduct(product_id=row[0], name=row[1], qty=int(row[2] or 0), total_cents=int(row[3] or 0))
            for row in rows
        ]
    )


@router.get("/low-stock", response_model=list[LowStockItem])
def low_stock(db: Db, _: CurrentUser, limit: int = Query(default=20, ge=1, le=100)):
    products = db.scalars(
        select(Product)
        .where(Product.is_active.is_(True), Product.stock <= Product.min_stock)
        .order_by(Product.stock.asc())
        .limit(limit)
    ).all()
    return [
        LowStockItem(product_id=product.id, name=product.name, stock=product.stock, min_stock=product.min_stock)
        for product in products
    ]
