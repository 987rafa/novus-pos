from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import AdminUser, Db
from app.core.security import hash_password
from app.models import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Db, _: AdminUser):
    """Administrador (dueño) primero; luego los cajeros vinculados, por nombre."""
    return db.scalars(select(User).order_by(User.role, User.name)).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Db, admin: AdminUser):
    """Crea un cajero vinculado al administrador actual (dueño de la instalación)."""
    if data.role == "admin":
        raise HTTPException(
            status_code=409,
            detail=(
                "Solo puede existir un administrador por instalación. "
                "Los demás usuarios se crean como cajeros vinculados al dueño."
            ),
        )
    if db.scalar(select(User).where(User.email == data.email.lower())) is not None:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo")
    user = User(
        email=data.email.lower(),
        name=data.name,
        role="cashier",
        owner_id=admin.id,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Db, admin: AdminUser):
    """Actualiza un cajero vinculado (nombre, estado o contraseña). El admin no se modifica."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.role == "admin":
        raise HTTPException(
            status_code=403,
            detail="El administrador es el dueño de la instalación y no se puede modificar",
        )
    if user.owner_id != admin.id:
        raise HTTPException(status_code=403, detail="Ese cajero no está vinculado a tu cuenta")
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "password":
            user.hashed_password = hash_password(value)
        else:
            setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user
