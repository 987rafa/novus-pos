def _create_sale(client, headers, product_id, qty, **extra):
    payload = {"items": [{"product_id": product_id, "qty": qty}], **extra}
    return client.post("/api/sales", headers=headers, json=payload)


def test_create_sale_totals_and_stock(client, cashier_headers, product):
    response = _create_sale(client, cashier_headers, product.id, 2)
    assert response.status_code == 201
    sale = response.json()

    assert sale["subtotal_cents"] == 200_000
    assert sale["discount_cents"] == 0
    assert sale["tax_cents"] == 38_000  # 19 % de IVA
    assert sale["total_cents"] == 238_000
    assert sale["status"] == "completed"
    assert sale["cashier_name"] == "caja"
    assert sale["items"][0]["product_name"] == "Producto de prueba"
    assert sale["items"][0]["line_total_cents"] == 200_000

    products = client.get("/api/products", headers=cashier_headers).json()
    assert products[0]["stock"] == 8  # 10 - 2


def test_sale_insufficient_stock(client, cashier_headers, product):
    response = _create_sale(client, cashier_headers, product.id, 999)
    assert response.status_code == 409
    assert "Stock insuficiente" in response.json()["detail"]

    products = client.get("/api/products", headers=cashier_headers).json()
    assert products[0]["stock"] == 10  # nada se descontó


def test_sale_discount_is_clamped(client, cashier_headers, product):
    response = _create_sale(client, cashier_headers, product.id, 1, discount_cents=99_999_999)
    assert response.status_code == 201
    sale = response.json()
    assert sale["discount_cents"] == sale["subtotal_cents"] == 100_000
    assert sale["tax_cents"] == 0
    assert sale["total_cents"] == 0


def test_sale_with_unknown_product(client, cashier_headers):
    response = _create_sale(client, cashier_headers, 424242, 1)
    assert response.status_code == 404


def test_void_sale_restocks_and_logs(client, admin_headers, cashier_headers, product):
    sale = _create_sale(client, cashier_headers, product.id, 3).json()

    response = client.post(f"/api/sales/{sale['id']}/void", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "voided"
    assert response.json()["voided_at"] is not None

    products = client.get("/api/products", headers=cashier_headers).json()
    assert products[0]["stock"] == 10  # repuesto completo

    movements = client.get(f"/api/products/{product.id}/movements", headers=admin_headers).json()
    reasons = [movement["reason"] for movement in movements]
    assert "sale" in reasons and "sale_void" in reasons


def test_void_twice_fails(client, admin_headers, cashier_headers, product):
    sale = _create_sale(client, cashier_headers, product.id, 1).json()
    client.post(f"/api/sales/{sale['id']}/void", headers=admin_headers)
    response = client.post(f"/api/sales/{sale['id']}/void", headers=admin_headers)
    assert response.status_code == 400


def test_cashier_cannot_void(client, admin_headers, cashier_headers, product):
    sale = _create_sale(client, admin_headers, product.id, 1).json()
    response = client.post(f"/api/sales/{sale['id']}/void", headers=cashier_headers)
    assert response.status_code == 403


def test_sales_list_and_detail(client, cashier_headers, product):
    sale = _create_sale(client, cashier_headers, product.id, 1).json()

    listing = client.get("/api/sales", headers=cashier_headers).json()
    assert listing["total"] == 1
    assert listing["items"][0]["id"] == sale["id"]

    detail = client.get(f"/api/sales/{sale['id']}", headers=cashier_headers)
    assert detail.status_code == 200
    assert detail.json()["items"][0]["qty"] == 1


def test_sale_payment_defaults_to_cash(client, cashier_headers, product):
    sale = _create_sale(client, cashier_headers, product.id, 1).json()
    assert sale["payment_method"] == "cash"
    assert sale["cash_received_cents"] is None
    assert sale["change_cents"] is None


def test_sale_with_transfer_and_card(client, cashier_headers, product):
    for method in ("transfer", "card"):
        sale = _create_sale(client, cashier_headers, product.id, 1, payment_method=method).json()
        assert sale["payment_method"] == method
        assert sale["cash_received_cents"] is None


def test_sale_cash_with_change(client, cashier_headers, product):
    sale = _create_sale(
        client, cashier_headers, product.id, 1, payment_method="cash", cash_received_cents=200_000
    ).json()
    assert sale["total_cents"] == 119_000
    assert sale["cash_received_cents"] == 200_000
    assert sale["change_cents"] == 81_000


def test_sale_cash_insufficient_received(client, cashier_headers, product):
    response = _create_sale(
        client, cashier_headers, product.id, 1, payment_method="cash", cash_received_cents=1_000
    )
    assert response.status_code == 400
    assert "no alcanza" in response.json()["detail"]

    products = client.get("/api/products", headers=cashier_headers).json()
    assert products[0]["stock"] == 10  # la venta no se concretó
