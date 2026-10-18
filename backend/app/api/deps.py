"""Dependencias compartidas: sesión de BD, usuario autenticado, roles y clave de pedidos."""
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)

Db = Annotated[Session, Depends(get_db)]


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Db,
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload.get("sub", ""))
    except Exception:
        raise unauthorized
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_roles(*roles: str):
    def checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")
        return user

    return checker


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles("admin"))]


def require_orders_key(x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None) -> None:
    """Canales externos de pedidos (WhatsApp/web): se autentican con la clave X-API-Key."""
    if not settings.orders_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Canal de pedidos deshabilitado — configura ORDERS_API_KEY",
        )
    if not x_api_key or not secrets.compare_digest(x_api_key, settings.orders_api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clave de pedidos inválida")
