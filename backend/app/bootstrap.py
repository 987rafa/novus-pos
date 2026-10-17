"""Garantiza la regla de oro: cada instalación tiene exactamente un administrador (el dueño).

Si la base de datos no tiene ningún admin (por ejemplo, una instalación sin datos demo),
se crea uno con las variables de entorno ``ADMIN_EMAIL`` / ``ADMIN_PASSWORD`` / ``ADMIN_NAME``.
"""
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User


def ensure_first_admin() -> None:
    """Crea el administrador único de la instalación si todavía no existe."""
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.role == "admin")) is not None:
            return
        email = settings.admin_email.lower()
        if db.scalar(select(User).where(User.email == email)) is not None:
            print(f"Bootstrap: ya existe un usuario con {email}; no se creó administrador.")
            return
        admin = User(
            email=email,
            name=settings.admin_name,
            role="admin",
            hashed_password=hash_password(settings.admin_password),
        )
        db.add(admin)
        db.commit()
        print(f"Bootstrap OK — administrador único de esta instalación: {email}")
    finally:
        db.close()
