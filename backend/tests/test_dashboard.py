def _sale(client, headers, product_id, qty=1):
    return client.post(
        "/api/sales", headers=headers, json={"items": [{"product_id": product_id, "qty": qty}]}
    )


def test_summary_counts(client, cashier_headers, product):
    _sale(client, cashier_headers, product.id, 2)
    body = client.get("/api/dashboard/summary", headers=cashier_headers).json()

    assert body["sales_today_count"] == 1
    assert body["sales_today_cents"] == 238_000
    assert body["sales_month_count"] == 1
    assert body["products_count"] == 1
    assert body["customers_count"] == 0
    assert body["low_stock_count"] == 0


def test_low_stock_alert(client, admin_headers, cashier_headers, product):
    # deja el stock en 2, por debajo del mínimo (3)
    client.post(
        f"/api/products/{product.id}/stock-adjust", headers=admin_headers, json={"qty_delta": -8}
    )

    summary = client.get("/api/dashboard/summary", headers=cashier_headers).json()
    assert summary["low_stock_count"] == 1

    low = client.get("/api/dashboard/low-stock", headers=cashier_headers).json()
    assert low[0]["product_id"] == product.id
    assert low[0]["stock"] == 2
    assert low[0]["min_stock"] == 3


def test_sales_series_shape(client, cashier_headers, product):
    _sale(client, cashier_headers, product.id, 1)
    body = client.get("/api/dashboard/sales-series?days=7", headers=cashier_headers).json()

    assert body["days"] == 7
    assert len(body["points"]) == 7
    assert sum(point["count"] for point in body["points"]) == 1
    assert body["points"][-1]["count"] == 1  # la venta de hoy cae en el último punto


def test_top_products(client, cashier_headers, product):
    _sale(client, cashier_headers, product.id, 5)
    body = client.get("/api/dashboard/top-products", headers=cashier_headers).json()

    assert body["items"][0]["name"] == "Producto de prueba"
    assert body["items"][0]["qty"] == 5
    assert body["items"][0]["total_cents"] == 500_000


def test_dashboard_requires_auth(client):
    assert client.get("/api/dashboard/summary").status_code == 401
