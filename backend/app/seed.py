"""Datos demo: usuarios, productos típicos de tienda de barrio y ventas de las últimas 2 semanas.

Uso:  python -m app.seed
Credenciales demo: admin@novus.dev / Admin123*  ·  caja@novus.dev / Caja123*
"""
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Customer, Product, StockMovement, User
from app.schemas.order import OrderCreate, OrderItemIn
from app.schemas.sale import SaleCreate, SaleItemIn
from app.services.orders import OrderError, create_order
from app.services.sales import SaleError, create_sale

PRODUCTS = [
    # (sku, nombre, categoría, precio COP, costo COP, stock, min_stock)
    ("GAS-400", "Gaseosa 400 ml", "Bebidas", 3500, 2200, 120, 24),
    ("AGU-600", "Agua 600 ml", "Bebidas", 2500, 1300, 150, 30),
    ("PAN-TAJ", "Pan tajado grande", "Panadería", 6200, 4300, 60, 12),
    ("LEC-1L", "Leche entera 1 L", "Lácteos", 4800, 3600, 80, 16),
    ("ARR-500", "Arroz 500 g", "Despensa", 2900, 2100, 90, 18),
    ("HUE-30", "Huevos x 30", "Despensa", 16500, 13200, 40, 8),
    ("ACE-1L", "Aceite girasol 1 L", "Despensa", 12300, 9800, 55, 10),
    ("CAF-250", "Café molido 250 g", "Despensa", 9800, 7300, 70, 14),
    ("CHO-45", "Chocolate de mesa x 10", "Despensa", 8900, 6800, 35, 8),
    ("PAP-105", "Papas fritas 105 g", "Snacks", 4100, 3000, 100, 20),
    ("CHO-ADD", "Chocorramo", "Snacks", 2500, 1700, 130, 26),
    ("DES-750", "Detergente 750 g", "Aseo", 7600, 5600, 45, 9),
    ("JAB-BAR", "Jabón de baño x 3", "Aseo", 6900, 5000, 50, 10),
    ("PAP-HIG", "Papel higiénico x 4", "Aseo", 8700, 6500, 48, 10),
]

CUSTOMERS = [
    ("María Fernanda Ríos", "+57 310 555 0134", "Barrio El Poblado"),
    ("Juan Camilo Torres", "+57 315 555 0198", "Cliente frecuente — fiado"),
    ("Luisa Gómez", "+57 300 555 0277", None),
    ("Andrés Felipe Muñoz", "+57 320 555 0341", "Tienda del barrio La Esperanza"),
    ("Carolina Herrera", "+57 312 555 0455", None),
    ("Pedro Antonio Díaz", "+57 318 555 0512", "Paga quincenal"),
]


def run_seed() -> None:
    Base.metadata.create_all(bind=engine)  # por si se ejecuta standalone (python -m app.seed)
    db = SessionLocal()
    try:
        if (db.scalar(select(func.count(User.id))) or 0) > 0:
            print("Seed: la base ya tiene datos, no hago nada.")
            return

        admin = User(
            email="admin@novus.dev", name="Ana Admin", role="admin", hashed_password=hash_password("Admin123*")
        )
        db.add(admin)
        db.flush()
        cashiers = [
            User(
                email="caja@novus.dev",
                name="Carlos Caja",
                role="cashier",
                hashed_password=hash_password("Caja123*"),
                owner_id=admin.id,
            ),
            User(
                email="caja2@novus.dev",
                name="Camila Cajera",
                role="cashier",
                hashed_password=hash_password("Caja123*"),
                owner_id=admin.id,
            ),
        ]
        db.add_all(cashiers)
        db.flush()

        products = [
            Product(
                sku=sku,
                barcode=f"77020010{index:05d}",
                name=name,
                category=category,
                price_cents=price * 100,
                cost_cents=cost * 100,
                stock=stock,
                min_stock=min_stock,
            )
            for index, (sku, name, category, price, cost, stock, min_stock) in enumerate(PRODUCTS, start=1)
        ]
        db.add_all(products)
        db.flush()
        for product in products:
            db.add(
                StockMovement(
                    product_id=product.id,
                    qty_delta=product.stock,
                    reason="initial",
                    note="Stock inicial de demo",
                    user_id=admin.id,
                )
            )

        customers = [Customer(name=name, phone=phone, notes=notes) for name, phone, notes in CUSTOMERS]
        db.add_all(customers)
        db.commit()

        rng = random.Random(7)
        now = datetime.now(timezone.utc)
        created = 0
        for _ in range(70):
            when = now - timedelta(days=rng.randint(0, 13), hours=rng.randint(0, 10), minutes=rng.randint(0, 59))
            seller = rng.choice(cashiers)
            picks = rng.sample(products, k=rng.randint(1, 4))
            items = [SaleItemIn(product_id=product.id, qty=rng.randint(1, 3)) for product in picks]
            customer = rng.choice(customers) if rng.random() < 0.7 else None
            payment = rng.choices(["cash", "transfer", "card"], weights=[6, 3, 1])[0]
            try:
                sale = create_sale(
                    db,
                    seller,
                    SaleCreate(
                        customer_id=customer.id if customer else None,
                        payment_method=payment,
                        items=items,
                    ),
                )
            except SaleError:
                continue
            sale.created_at = when
            if sale.payment_method == "cash":
                received = ((sale.total_cents + 4_999) // 5_000) * 5_000
                sale.cash_received_cents = received
                sale.change_cents = received - sale.total_cents
            db.commit()
            created += 1

        # Pedidos demo entrantes (WhatsApp/web) para probar la pantalla de Pedidos
        demo_orders = [
            ("whatsapp", "María Fernanda Ríos", "+57 310 555 0134", "Para recoger a las 5 pm", [(2, 1), (3, 2), (10, 2)]),
            ("whatsapp", "Pedro Antonio Díaz", "+57 318 555 0512", None, [(0, 4), (9, 1)]),
            ("web", "Luisa Gómez", "+57 300 555 0277", "Sin bolsas plásticas, por favor", [(4, 2), (7, 1)]),
        ]
        orders_created = 0
        for channel, name, phone, note, picks in demo_orders:
            try:
                order = create_order(
                    db,
                    OrderCreate(
                        channel=channel,
                        customer_name=name,
                        customer_phone=phone,
                        note=note,
                        items=[OrderItemIn(product_id=products[index].id, qty=qty) for index, qty in picks],
                    ),
                )
            except OrderError:
                continue
            order.created_at = now - timedelta(minutes=rng.randint(3, 90))
            db.commit()
            orders_created += 1

        print(
            "Seed OK — admin@novus.dev / Admin123* · caja@novus.dev y caja2@novus.dev / Caja123* · "
            f"{len(products)} productos · {len(customers)} clientes · {created} ventas · {orders_created} pedidos"
        )
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
