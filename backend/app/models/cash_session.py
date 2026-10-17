from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow


class CashSession(Base):
    """Turno de caja: apertura con base inicial y cierre con arqueo (contado vs. esperado).

    Reglas:
    - Solo puede haber UNA caja abierta a la vez por instalación.
    - El "esperado" al cerrar = base inicial + ventas en efectivo del turno (las anuladas restan).
    - La cierra quien la abrió o el administrador.
    """

    __tablename__ = "cash_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open | closed
    opened_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    opening_cents: Mapped[int] = mapped_column(Integer, default=0)
    closed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expected_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)  # calculado al cerrar
    counted_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)  # contado físico
    difference_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)  # contado − esperado
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
