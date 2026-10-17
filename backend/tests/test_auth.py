def test_login_ok(client, cashier):
    response = client.post("/api/auth/login", json={"email": "caja@test.dev", "password": "Caja123*"})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "cashier"
    assert body["user"]["email"] == "caja@test.dev"


def test_login_wrong_password(client, cashier):
    response = client.post("/api/auth/login", json={"email": "caja@test.dev", "password": "incorrecta"})
    assert response.status_code == 401


def test_login_unknown_user(client):
    response = client.post("/api/auth/login", json={"email": "nadie@test.dev", "password": "x123456"})
    assert response.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_token(client, admin_headers):
    response = client.get("/api/auth/me", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "admin@test.dev"
    assert response.json()["role"] == "admin"
