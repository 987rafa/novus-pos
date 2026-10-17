from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.api.deps import AdminUser, CurrentUser, Db
from app.models import Sale
from app.schemas.customer import CustomerBrief
from app.schemas.sale import SaleCreate, SaleItemOut, SaleListOut, SaleOut
from app.services.sales import SaleError, create_sale, void_sale

router = APIRouter(prefix="/sales", tags=["sales"])


def sale_to_out(sale: Sale) -> SaleOut:
    return SaleOut(
        id=sale.id,
        status=sale.status,
        created_at=sale.created_at,
        voided_at=sale.voided_at,
        cashier_name=sale.user.name if sale.user else None,
        customer=CustomerBrief(id=sale.customer.id, name=sale.customer.name) if sale.customer else None,
        subtotal_cents=sale.subtotal_cents,
        discount_cents=sale.discount_cents,
        tax_cents=sale.tax_cents,
        total_cents=sale.total_cents,
        items=[SaleItemOut.model_validate(item) for item in sale.items],
    )


@router.post("", response_model=SaleOut, status_code=201)
def register_sale(data: SaleCreate, db: Db, user: CurrentUser):
    try:
        sale = create_sale(db, user, data)
    except SaleError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)
    return sale_to_out(sale)


@router.get("", response_model=SaleListOut)
def list_sales(
    db: Db,
    _: CurrentUser,
    status: str | None = Query(default=None, max_length=20),
    customer_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    filters = []
    if status:
        filters.append(Sale.status == status)
    if customer_id:
        filters.append(Sale.customer_id == customer_id)
    if date_from:
        filters.append(Sale.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        filters.append(
            Sale.created_at < datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )

    count_stmt = select(func.count(Sale.id))
    list_stmt = select(Sale).order_by(Sale.id.desc()).limit(limit).offset(offset)
    for condition in filters:
        count_stmt = count_stmt.where(condition)
        list_stmt = list_stmt.where(condition)

    total = db.scalar(count_stmt) or 0
    sales = db.scalars(list_stmt).all()
    return SaleListOut(total=total, items=[sale_to_out(sale) for sale in sales])


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Db, _: CurrentUser):
    sale = db.get(Sale, sale_id)
    if sale is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale_to_out(sale)


@router.post("/{sale_id}/void", response_model=SaleOut)
def void(sale_id: int, db: Db, user: AdminUser):
    sale = db.get(Sale, sale_id)
    if sale is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    try:
        sale = void_sale(db, sale, user)
    except SaleError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)
    return sale_to_out(sale)
