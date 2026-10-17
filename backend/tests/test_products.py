PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"novus-demo" * 8  # firma PNG válida para la validación


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


def test_create_product_with_barcode_and_lookup(client, admin_headers):
    created = client.post(
        "/api/products",
        headers=admin_headers,
        json={
            "sku": "BAR-1",
            "barcode": "7702001000001",
            "name": "Producto con código",
            "price_cents": 500_000,
        },
    )
    assert created.status_code == 201
    assert created.json()["barcode"] == "7702001000001"

    found = client.get("/api/products/barcode/7702001000001", headers=admin_headers)
    assert found.status_code == 200
    assert found.json()["sku"] == "BAR-1"

    search = client.get("/api/products?q=7702001000001", headers=admin_headers).json()
    assert [item["sku"] for item in search] == ["BAR-1"]

    missing = client.get("/api/products/barcode/0000000000000", headers=admin_headers)
    assert missing.status_code == 404


def test_barcode_lookup_falls_back_to_sku(client, admin_headers, product):
    response = client.get("/api/products/barcode/TEST-1", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["id"] == product.id


def test_duplicate_barcode_rejected(client, admin_headers):
    first = client.post(
        "/api/products",
        headers=admin_headers,
        json={"sku": "BAR-2", "barcode": "7709999999999", "name": "Uno", "price_cents": 100},
    )
    assert first.status_code == 201
    second = client.post(
        "/api/products",
        headers=admin_headers,
        json={"sku": "BAR-3", "barcode": "7709999999999", "name": "Dos", "price_cents": 100},
    )
    assert second.status_code == 409


def test_update_product_clears_barcode_with_empty_string(client, admin_headers):
    created = client.post(
        "/api/products",
        headers=admin_headers,
        json={"sku": "BAR-4", "barcode": "7701111111111", "name": "Cuatro", "price_cents": 100},
    ).json()
    response = client.patch(
        f"/api/products/{created['id']}", headers=admin_headers, json={"barcode": ""}
    )
    assert response.status_code == 200
    assert response.json()["barcode"] is None


def test_upload_product_image(client, admin_headers, product):
    response = client.post(
        f"/api/products/{product.id}/image",
        headers=admin_headers,
        files={"file": ("foto.png", PNG_BYTES, "image/png")},
    )
    assert response.status_code == 200
    image_url = response.json()["image_url"]
    assert image_url.startswith("/uploads/products/")
    assert image_url.endswith(".png")

    served = client.get(image_url)
    assert served.status_code == 200
    assert served.content == PNG_BYTES


def test_upload_product_image_rejects_non_image(client, admin_headers, product):
    response = client.post(
        f"/api/products/{product.id}/image",
        headers=admin_headers,
        files={"file": ("nota.txt", b"hola", "text/plain")},
    )
    assert response.status_code == 400


def test_upload_product_image_rejects_oversize(client, admin_headers, product):
    big = b"\x89PNG\r\n\x1a\n" + b"0" * (2 * 1024 * 1024)
    response = client.post(
        f"/api/products/{product.id}/image",
        headers=admin_headers,
        files={"file": ("grande.png", big, "image/png")},
    )
    assert response.status_code == 400


def test_cashier_cannot_upload_image(client, cashier_headers, product):
    response = client.post(
        f"/api/products/{product.id}/image",
        headers=cashier_headers,
        files={"file": ("foto.png", PNG_BYTES, "image/png")},
    )
    assert response.status_code == 403
