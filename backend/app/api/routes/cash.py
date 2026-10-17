"""Caja (turnos y arqueo): abrir con base inicial, cerrar contando el efectivo y ver el historial."""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.api.deps import CurrentUser, Db
from app.db.base import utcnow
from app.models import CashSession, Sale, User
from app.schemas.cash import CashCloseIn, CashOpenIn, CashSessionOut, CashStatusOut

router = APIRouter(prefix="/cash", tags=["cash"])


def _user_name(db: Db, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    user = db.get(User, user_id)
    return user.name if user else None


def _session_out(db: Db, session: CashSession) -> CashSessionOut:
    return CashSessionOut(
        id=session.id,
        status=session.status,
        opened_by_name=_user_name(db, session.opened_by_id) or "—",
        opened_at=session.opened_at,
        opening_cents=session.opening_cents,
        closed_by_name=_user_name(db, session.closed_by_id),
        closed_at=session.closed_at,
        expected_cents=session.expected_cents,
        counted_cents=session.counted_cents,
        difference_cents=session.difference_cents,
        note=session.note,
    )


def _cash_sales(db: Db, since) -> tuple[int, int]:
    """(neto en centavos, ventas vigentes) del efectivo del turno desde ``since``.

    Entra: ventas en efectivo registradas en el turno. Sale: anulaciones (devoluciones)
    hechas en el turno, aunque la venta original sea de antes.
    """
    inflow = db.scalar(
        select(func.coalesce(func.sum(Sale.total_cents), 0)).where(
            Sale.payment_method == "cash",
            Sale.created_at >= since,
        )
    )
    outflow = db.scalar(
        select(func.coalesce(func.sum(Sale.total_cents), 0)).where(
            Sale.payment_method == "cash",
            Sale.status == "voided",
            Sale.voided_at >= since,
        )
    )
    count = db.scalar(
        select(func.count(Sale.id)).where(
            Sale.payment_method == "cash",
            Sale.status == "completed",
            Sale.created_at >= since,
        )
    )
    return int(inflow) - int(outflow), int(count)


def _open_session(db: Db) -> CashSession | None:
    return db.scalar(select(CashSession).where(CashSession.status == "open").order_by(CashSession.id.desc()))


@router.get("/status", response_model=CashStatusOut)
def cash_status(db: Db, _: CurrentUser):
    session = _open_session(db)
    if session is None:
        return CashStatusOut(is_open=False)
    cash_cents, cash_count = _cash_sales(db, session.opened_at)
    return CashStatusOut(
        is_open=True,
        session=_session_out(db, session),
        cash_sales_cents=cash_cents,
        cash_sales_count=cash_count,
        expected_cents=session.opening_cents + cash_cents,
    )


@router.post("/open", response_model=CashSessionOut, status_code=201)
def open_cash(data: CashOpenIn, db: Db, user: CurrentUser):
    if _open_session(db) is not None:
        raise HTTPException(status_code=409, detail="Ya hay una caja abierta; ciérrala antes de abrir otra")
    session = CashSession(
        status="open",
        opened_by_id=user.id,
        opening_cents=data.opening_cents,
        opened_at=utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_out(db, session)


@router.post("/close", response_model=CashSessionOut)
def close_cash(data: CashCloseIn, db: Db, user: CurrentUser):
    session = _open_session(db)
    if session is None:
        raise HTTPException(status_code=409, detail="No hay ninguna caja abierta")
    if session.opened_by_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Solo quien abrió la caja o el administrador pueden cerrarla"
        )
    cash_cents, _ = _cash_sales(db, session.opened_at)
    expected = session.opening_cents + cash_cents
    session.status = "closed"
    session.closed_by_id = user.id
    session.closed_at = utcnow()
    session.expected_cents = expected
    session.counted_cents = data.counted_cents
    session.difference_cents = data.counted_cents - expected
    session.note = data.note
    db.commit()
    db.refresh(session)
    return _session_out(db, session)


@router.get("/sessions", response_model=list[CashSessionOut])
def list_sessions(db: Db, _: CurrentUser, limit: int = Query(default=20, ge=1, le=100)):
    stmt = select(CashSession).order_by(CashSession.id.desc()).limit(limit)
    return [_session_out(db, session) for session in db.scalars(stmt)]
