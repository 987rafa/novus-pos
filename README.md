<div align="center">

# NOVUS POS 🧾

**Point of sale & inventory for small shops — by [NOVUS DEV](https://github.com/987rafa)**

[![CI](https://github.com/987rafa/novus-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/987rafa/novus-pos/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-25d366)

</div>

Point of sale and inventory API for small shops (tiendas, panaderías, minimercados): register sales from a cart, keep stock under control with a full movement history, and watch the business with a real-time dashboard.

> 🇪🇸 [Leer en español](README.es.md) · 🚧 Web UI (React + TypeScript) in progress

## ✨ Features

- 🛒 **Sales with cart API** — multi-item sales, per-sale discounts, 19 % IVA applied automatically, stock validated & decremented in a single transaction
- 📦 **Inventory with audit trail** — every entry/exit is logged (initial stock, adjustments, sales, voids); low-stock alerts with configurable minimums
- ↔️ **Void & restock** — cancel a sale (admin only) and stock flows back, fully logged
- 👥 **Customers** — optional customer on each sale, search by name or phone
- 📊 **Dashboard analytics** — sales today/month, 14-day series, top products, low-stock list
- 🔐 **JWT auth with roles** — `admin` / `cashier`, passwords hashed with argon2
- 🧪 **Tested** — pytest suite covering auth, products, stock movements, sales and dashboard
- 🐳 **One command to run** — Docker Compose (API + PostgreSQL)

## 🧰 Stack

| Layer | Tech |
| --- | --- |
| API | FastAPI · SQLAlchemy 2.0 · Pydantic v2 |
| DB | PostgreSQL (Docker/prod) · SQLite (local dev) |
| Auth | JWT (PyJWT) · argon2 (pwdlib) |
| Tooling | pytest · Docker Compose · GitHub Actions |
| Frontend | React + TypeScript *(roadmap)* |

## 🚀 Quickstart

### Docker (recommended)

```bash
docker compose up --build
# API docs → http://localhost:8000/docs
```

### Local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env                  # adjust if needed
SEED_ON_STARTUP=true python -m uvicorn app.main:app --reload
# or seed manually: python -m app.seed
```

### Demo credentials (created by the seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@novus.dev` | `Admin123*` |
| Cashier | `caja@novus.dev` | `Caja123*` |

> ⚠️ Demo data only — change these before any real deployment.

## 🧪 Tests

```bash
cd backend && python -m pytest -q
```

## 🔌 API overview

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login` · `GET /api/auth/me` |
| Products | CRUD + `POST /api/products/{id}/stock-adjust` · `GET /api/products/{id}/movements` |
| Customers | CRUD with search |
| Sales | `POST /api/sales` · list/detail · `POST /api/sales/{id}/void` (admin) |
| Dashboard | `summary` · `sales-series` · `top-products` · `low-stock` |
| Users | admin-only CRUD |

Full interactive reference at `/docs` (OpenAPI/Swagger).

## 🗺️ Roadmap

- [x] Backend API: sales, inventory, dashboard, roles & tests
- [ ] Web UI (React + TypeScript): POS screen, products, dashboard
- [ ] Live demo
- [ ] WhatsApp orders — incoming orders flow straight into the POS (pairs with [whatsapp-ai-agent](https://github.com/987rafa/whatsapp-ai-agent))

## 📄 License

MIT © [Rafael Álvarez · NOVUS DEV](https://github.com/987rafa)
