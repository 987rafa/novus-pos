"""Caja: apertura con base, arqueo al cerrar (contado vs. esperado) e historial de turnos."""


def _sale(client, headers, product_id, qty=1, **extra):
    payload = {"items": [{"product_id": product_id, "qty": qty}], **extra}
    return client.post("/api/sales", headers=headers, json=payload)


def _open(client, headers, opening=50_000):
    return client.post("/api/cash/open", headers=headers, json={"opening_cents": opening})


def _close(client, headers, counted, note=None):
    return client.post("/api/cash/close", headers=headers, json={"counted_cents": counted, "note": note})


def test_open_close_flow_with_arqueo(client, cashier_headers, product):
    assert client.get("/api/cash/status", headers=cashier_headers).json()["is_open"] is False

    opened = _open(client, cashier_headers)
    assert opened.status_code == 201
    body = opened.json()
    assert body["status"] == "open"
    assert body["opening_cents"] == 50_000
    assert body["opened_by_name"] == "caja"

    assert _open(client, cashier_headers).status_code == 409  # ya hay una abierta

    _sale(client, cashier_headers, product.id, 1, payment_method="cash")
    _sale(client, cashier_headers, product.id, 2, payment_method="transfer")

    status = client.get("/api/cash/status", headers=cashier_headers).json()
    assert status["is_open"] is True
    assert status["cash_sales_cents"] == 119_000
    assert status["cash_sales_count"] == 1
    assert status["expected_cents"] == 169_000  # 50.000 + 119.000

    closed = _close(client, cashier_headers, 167_000, note="Faltó dinero")
    assert closed.status_code == 200
    body = closed.json()
    assert body["status"] == "closed"
    assert body["expected_cents"] == 169_000
    assert body["counted_cents"] == 167_000
    assert body["difference_cents"] == -2_000
    assert body["closed_by_name"] == "caja"

    assert client.get("/api/cash/status", headers=cashier_headers).json()["is_open"] is False
    assert _close(client, cashier_headers, 0).status_code == 409  # no hay caja abierta


def test_only_opener_or_admin_can_close(client, admin_headers, cashier_headers):
    _open(client, cashier_headers)
    client.post(
        "/api/users",
        headers=admin_headers,
        json={"email": "caja3@test.dev", "name": "Otra Caja", "password": "Clave123*"},
    )
    login = client.post("/api/auth/login", json={"email": "caja3@test.dev", "password": "Clave123*"}).json()
    other = {"Authorization": f"Bearer {login['access_token']}"}

    denied = _close(client, other, 100_000)
    assert denied.status_code == 403

    allowed = _close(client, admin_headers, 100_000)
    assert allowed.status_code == 200
    assert allowed.json()["closed_by_name"] == "admin"


def test_voided_cash_sale_subtracts_from_expected(client, admin_headers, cashier_headers, product):
    _open(client, cashier_headers, opening=0)
    sale = _sale(client, cashier_headers, product.id, 1, payment_method="cash").json()
    client.post(f"/api/sales/{sale['id']}/void", headers=admin_headers)

    status = client.get("/api/cash/status", headers=admin_headers).json()
    assert status["cash_sales_cents"] == 0

    closed = _close(client, cashier_headers, 0).json()
    assert closed["expected_cents"] == 0
    assert closed["difference_cents"] == 0


def test_cash_history(client, cashier_headers):
    _open(client, cashier_headers, opening=10_000)
    _close(client, cashier_headers, 10_000, note="Turno corto")
    history = client.get("/api/cash/sessions", headers=cashier_headers).json()
    assert len(history) == 1
    assert history[0]["status"] == "closed"
    assert history[0]["note"] == "Turno corto"
