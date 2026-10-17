from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    role: str
    owner_id: int | None = None
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6, max_length=128)
    role: Literal["admin", "cashier"] = "cashier"


class UserUpdate(BaseModel):
    """Actualización de un cajero. El rol no se puede cambiar: no existen segundos administradores."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
