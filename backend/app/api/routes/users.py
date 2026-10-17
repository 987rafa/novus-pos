from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import AdminUser, Db
from app.core.security import hash_password
from app.models import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Db, _: AdminUser):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Db, _: AdminUser):
    if db.scalar(select(User).where(User.email == data.email.lower())) is not None:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo")
    user = User(
        email=data.email.lower(),
        name=data.name,
        role=data.role,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Db, _: AdminUser):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "password":
            user.hashed_password = hash_password(value)
        else:
            setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user
