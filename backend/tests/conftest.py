import os
import tempfile

# Configuración de pruebas — debe ir ANTES de importar la app
_tmpdir = tempfile.mkdtemp(prefix="novus-pos-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmpdir}/app.db"
os.environ["SECRET_KEY"] = "test-secret-key-0123456789abcdef-0123456789"
os.environ["SEED_ON_STARTUP"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401 — registra los modelos en Base.metadata
from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Product, User  # noqa: E402


@pytest.fixture(scope="session")
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=eng)
    return eng


@pytest.fixture()
def db_session(engine):
    # Base limpia en cada prueba
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    session = Session(bind=engine, autoflush=False, autocommit=False)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _create_user(db: Session, email: str, role: str, password: str, owner_id: int | None = None) -> User:
    user = User(
        email=email,
        name=email.split("@")[0],
        role=role,
        hashed_password=hash_password(password),
        owner_id=owner_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def admin(db_session) -> User:
    return _create_user(db_session, "admin@test.dev", "admin", "Admin123*")


@pytest.fixture()
def cashier(db_session, admin) -> User:
    return _create_user(db_session, "caja@test.dev", "cashier", "Caja123*", owner_id=admin.id)


@pytest.fixture()
def admin_headers(client, admin) -> dict[str, str]:
    return _login(client, "admin@test.dev", "Admin123*")


@pytest.fixture()
def cashier_headers(client, cashier) -> dict[str, str]:
    return _login(client, "caja@test.dev", "Caja123*")


@pytest.fixture()
def product(db_session) -> Product:
    item = Product(
        sku="TEST-1",
        name="Producto de prueba",
        price_cents=100_000,
        cost_cents=60_000,
        stock=10,
        min_stock=3,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item
