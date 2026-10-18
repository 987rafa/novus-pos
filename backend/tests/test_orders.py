"""Pedidos entrantes: canal externo (X-API-Key) → pendiente → caja confirma (venta) o rechaza."""
import pytest

from app.core.config import settings
from app.models import Product

KEY = "test-orders-key"


def _headers():
    return {"X-API-Key": KEY}


def _payload(product_id, qty=1, **extra):
    return {"items": [{"product_id": product_id, "qty": qty}], **extra}


def _create_order(client, product_id, qty=1, **extra):
    return client.post("/api/orders", headers=_headers(), json=_payload(product_id, qty, **extra))


@pytest.fixture(autouse=True)
def orders_key():
    previous = settings.orders_api_key
    settings.orders_api_key = KEY
    yield
    settings.orders_api_key = previous


def test_create_order_computes_totals_and_waits_for_stock(client, cashier_headers, product):
    order = _create_order(client, product.id, 2).json()

    assert order["subtotal_cents"] == 200_000
    assert order["tax_cents"] == 38_000  # 19 % de IVA
    assert order["total_cents"] == 238_000
    assert order["status"] == "pending"
    assert order["channel"] == "whatsapp"  # canal por defecto
    assert order["items"][0]["product_name"] == "Producto de prueba"

    # El stock solo se descuenta al confirmar, no al crear el pedido
    products = client.get("/api/products", headers=cashier_headers).json()
    assert products[0]["stock"] == 10


def test_create_order_merges_repeated_lines(client, product):
    response = client.post(
        "/api/orders",
        headers=_headers(),
        json={"items": [{"product_id": product.id, "qty": 1}, {"product_id": product.id, "qty": 2}]},
    )
    assert response.status_code == 201
    order = response.json()
    assert len(order["items"]) == 1
    assert order["items"][0]["qty"] == 3


def test_order_fields_roundtrip(client, product):
    order = _create_order(
        client,
        product.id,
        1,
        channel="web",
        customer_name="Luisa Gómez",
        customer_phone="+57 300 555 0277",
        note="Sin bolsas plásticas",
    ).json()

    assert order["channel"] == "web"
    assert order["customer_name"] == "Luisa Gómez"
    assert order["customer_phone"] == "+57 300 555 0277"
    assert order["note"] == "Sin bolsas plásticas"
    assert order["created_at"] is not None


def test_orders_channel_requires_key(client, product):
    assert client.post("/api/orders", json=_payload(product.id)).status_code == 401
    assert client.post("/api/orders", headers={"X-API-Key": "clave-mala"}, json=_payload(product.id)).status_code == 401
    assert client.get("/api/orders/catalog").status_code == 401


def test_orders_channel_disabled_without_config(client, product):
    settings.orders_api_key = ""
    response = client.post("/api/orders", headers=_headers(), json=_payload(product.id))
    assert response.status_code == 503


def test_create_order_unknown_product(client):
    response = _create_order(client, 424242, 1)
    assert response.status_code == 404


def test_create_order_insufficient_stock(client, cashier_headers, product):
    response = _create_order(client, product.id, 999)
    assert response.status_code == 409
    assert "Stock insuficiente" in response.json()["detail"]
    products = client.get("/api/products", headers=cashier_headers).json()
    assert products[0]["stock"] == 10


def test_catalog_lists_actives_only(client, product, db_session):
    hidden = Product(sku="OCULTO-1", name="Producto oculto", price_cents=1_000, stock=1, is_active=False)
    db_session.add(hidden)
    db_session.commit()

    response = client.get("/api/orders/catalog", headers=_headers())
    assert response.status_code == 200
    names = [item["name"] for item in response.json()]
    assert "Producto de prueba" in names
    assert "Producto oculto" not in names


def test_list_orders_requires_auth_and_filters(client, cashier_headers, product):
    assert client.get("/api/orders").status_code == 401

    first = _create_order(client, product.id, 1).json()
    _create_order(client, product.id, 2)
    client.post(f"/api/orders/{first['id']}/reject", headers=cashier_headers, json={"reason": "Sin stock"})

    pending = client.get("/api/orders?status=pending", headers=cashier_headers).json()
    assert pending["total"] == 1

    all_orders = client.get("/api/orders", headers=cashier_headers).json()
    assert all_orders["total"] == 2


def test_confirm_order_creates_sale_and_moves_stock(client, cashier_headers, product):
    order = _create_order(client, product.id, 2).json()

    response = client.post(
        f"/api/orders/{order['id']}/confirm", headers=cashier_headers, json={"payment_method": "transfer"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "confirmed"
    assert body["sale_id"] is not None
    assert body["confirmed_at"] is not None

    sale = client.get(f"/api/sales/{body['sale_id']}", headers=cashier_headers).json()
    assert sale["payment_method"] == "transfer"
    assert sale["total_cents"] == body["total_cents"]
    assert sale["items"][0]["qty"] == 2

    products = client.get("/api/products", headers=cashier_headers).json()
    assert products[0]["stock"] == 8  # 10 - 2


def test_confirm_cash_with_change(client, cashier_headers, product):
    order = _create_order(client, product.id, 1).json()  # total 119_000

    body = client.post(
        f"/api/orders/{order['id']}/confirm",
        headers=cashier_headers,
        json={"payment_method": "cash", "cash_received_cents": 120_000},
    ).json()

    sale = client.get(f"/api/sales/{body['sale_id']}", headers=cashier_headers).json()
    assert sale["change_cents"] == 1_000


def test_confirm_twice_fails(client, cashier_headers, product):
    order = _create_order(client, product.id, 1).json()
    first = client.post(f"/api/orders/{order['id']}/confirm", headers=cashier_headers, json={})
    assert first.status_code == 200
    second = client.post(f"/api/orders/{order['id']}/confirm", headers=cashier_headers, json={})
    assert second.status_code == 400


def test_confirm_with_insufficient_stock_keeps_pending(client, cashier_headers, product):
    order = _create_order(client, product.id, 6).json()
    # Una venta consume stock y deja solo 4 disponibles
    client.post("/api/sales", headers=cashier_headers, json={"items": [{"product_id": product.id, "qty": 6}]})

    response = client.post(f"/api/orders/{order['id']}/confirm", headers=cashier_headers, json={})
    assert response.status_code == 409

    detail = client.get(f"/api/orders/{order['id']}", headers=cashier_headers).json()
    assert detail["status"] == "pending"
    assert detail["sale_id"] is None


def test_reject_order_and_reject_processed(client, cashier_headers, product):
    order = _create_order(client, product.id, 1).json()

    response = client.post(
        f"/api/orders/{order['id']}/reject", headers=cashier_headers, json={"reason": "Ya no hay disponible"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "rejected"
    assert body["rejected_reason"] == "Ya no hay disponible"
    assert body["rejected_at"] is not None

    # Un pedido rechazado ya no se puede confirmar ni volver a rechazar
    assert client.post(f"/api/orders/{order['id']}/confirm", headers=cashier_headers, json={}).status_code == 400
    assert client.post(f"/api/orders/{order['id']}/reject", headers=cashier_headers, json={}).status_code == 400


def test_get_unknown_order(client, cashier_headers):
    assert client.get("/api/orders/9999", headers=cashier_headers).status_code == 404
