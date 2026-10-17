def test_create_product_admin_records_initial_stock(client, admin_headers):
    response = client.post(
        "/api/products",
        headers=admin_headers,
        json={"sku": "GAS-1", "name": "Gaseosa", "price_cents": 350_000, "stock": 12, "min_stock": 4},
    )
    assert response.status_code == 201
    product = response.json()
    assert product["stock"] == 12

    movements = client.get(f"/api/products/{product['id']}/movements", headers=admin_headers).json()
    assert len(movements) == 1
    assert movements[0]["qty_delta"] == 12
    assert movements[0]["reason"] == "initial"


def test_create_product_duplicate_sku(client, admin_headers, product):
    response = client.post(
        "/api/products",
        headers=admin_headers,
        json={"sku": "TEST-1", "name": "Otro producto", "price_cents": 100},
    )
    assert response.status_code == 409


def test_cashier_cannot_create_product(client, cashier_headers):
    response = client.post(
        "/api/products",
        headers=cashier_headers,
        json={"sku": "X-1", "name": "Producto X", "price_cents": 100},
    )
    assert response.status_code == 403


def test_list_requires_auth(client):
    assert client.get("/api/products").status_code == 401


def test_search_product(client, admin_headers, product):
    response = client.get("/api/products?q=prueba", headers=admin_headers)
    assert response.status_code == 200
    assert [item["sku"] for item in response.json()] == ["TEST-1"]


def test_stock_adjust_ok_and_movement(client, admin_headers, product):
    response = client.post(
        f"/api/products/{product.id}/stock-adjust",
        headers=admin_headers,
        json={"qty_delta": -4, "note": "Merma"},
    )
    assert response.status_code == 200
    assert response.json()["stock"] == 6

    movements = client.get(f"/api/products/{product.id}/movements", headers=admin_headers).json()
    assert movements[0]["qty_delta"] == -4
    assert movements[0]["reason"] == "adjustment"


def test_stock_adjust_below_zero(client, admin_headers, product):
    response = client.post(
        f"/api/products/{product.id}/stock-adjust",
        headers=admin_headers,
        json={"qty_delta": -999},
    )
    assert response.status_code == 409


def test_update_product(client, admin_headers, product):
    response = client.patch(
        f"/api/products/{product.id}",
        headers=admin_headers,
        json={"price_cents": 120_000},
    )
    assert response.status_code == 200
    assert response.json()["price_cents"] == 120_000
