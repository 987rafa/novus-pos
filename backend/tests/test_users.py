"""Reglas de usuarios: UN administrador por instalación + cajeros vinculados al dueño."""
from sqlalchemy import select

from app.bootstrap import ensure_first_admin
from app.db.session import SessionLocal
from app.models import User


def test_list_users_admin_first(client, admin, cashier, admin_headers):
    response = client.get("/api/users", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert [item["role"] for item in body] == ["admin", "cashier"]
    assert body[0]["email"] == "admin@test.dev"
    assert body[0]["owner_id"] is None
    assert body[1]["owner_id"] == admin.id


def test_create_cashier_is_linked_to_admin(client, admin, admin_headers):
    response = client.post(
        "/api/users",
        headers=admin_headers,
        json={"email": "nuevo@test.dev", "name": "Nuevo Cajero", "password": "Clave123*"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["role"] == "cashier"
    assert body["owner_id"] == admin.id
    assert body["is_active"] is True


def test_cannot_create_second_admin(client, admin_headers):
    response = client.post(
        "/api/users",
        headers=admin_headers,
        json={"email": "jefe2@test.dev", "name": "Otro Jefe", "password": "Clave123*", "role": "admin"},
    )
    assert response.status_code == 409
    assert "solo puede existir un administrador" in response.json()["detail"].lower()


def test_admin_account_cannot_be_modified(client, admin, admin_headers):
    response = client.patch(f"/api/users/{admin.id}", headers=admin_headers, json={"name": "Hackeado"})
    assert response.status_code == 403


def test_update_cashier_name(client, cashier, admin_headers):
    response = client.patch(f"/api/users/{cashier.id}", headers=admin_headers, json={"name": "Carlos Renombrado"})
    assert response.status_code == 200
    assert response.json()["name"] == "Carlos Renombrado"


def test_admin_can_reset_cashier_password(client, cashier, admin_headers):
    response = client.patch(f"/api/users/{cashier.id}", headers=admin_headers, json={"password": "Nueva123*"})
    assert response.status_code == 200
    login = client.post("/api/auth/login", json={"email": "caja@test.dev", "password": "Nueva123*"})
    assert login.status_code == 200


def test_deactivated_cashier_cannot_login(client, cashier, admin_headers):
    response = client.patch(f"/api/users/{cashier.id}", headers=admin_headers, json={"is_active": False})
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    login = client.post("/api/auth/login", json={"email": "caja@test.dev", "password": "Caja123*"})
    assert login.status_code == 403


def test_cashier_cannot_manage_users(client, cashier_headers):
    assert client.get("/api/users", headers=cashier_headers).status_code == 403
    created = client.post(
        "/api/users",
        headers=cashier_headers,
        json={"email": "x@test.dev", "name": "X", "password": "Clave123*"},
    )
    assert created.status_code == 403


def test_bootstrap_keeps_single_admin(client):
    """El arranque garantiza un único admin, aunque se ejecute varias veces."""
    ensure_first_admin()
    ensure_first_admin()
    db = SessionLocal()
    try:
        admins = db.scalars(select(User).where(User.role == "admin")).all()
    finally:
        db.close()
    assert len(admins) == 1
