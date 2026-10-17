<div align="center">

# NOVUS POS 🧾

**Point of sale & inventory for small shops — by [NOVUS DEV](https://github.com/987rafa)**

[![CI](https://github.com/987rafa/novus-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/987rafa/novus-pos/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-25d366)

</div>

Full-stack point of sale and inventory system for small shops (tiendas, panaderías, minimercados): register sales from a cart with automatic 19 % VAT, keep stock under control with a full movement history, and watch the business with a real-time dashboard.

> 🇪🇸 [Leer en español](README.es.md)

## 📸 Screenshots

| Dashboard | Point of sale |
| --- | --- |
| ![Dashboard](docs/shots/02-dashboard.png) | ![POS](docs/shots/03-pos.png) |

| Products & inventory | Sale detail |
| --- | --- |
| ![Products](docs/shots/04-productos.png) | ![Sale detail](docs/shots/06-venta-detalle.png) |

| Users & cashiers | Sales history |
| --- | --- |
| ![Users](docs/shots/08-usuarios.png) | ![Sales](docs/shots/05-ventas.png) |

## ✨ Features

- 🖥️ **Web UI in Spanish** (React + TypeScript, mobile-friendly): POS screen with cart, product & stock management, users (owner + linked cashiers), sales history and analytics dashboard
- 🛒 **Sales with cart** — multi-item sales, per-sale discounts, 19 % VAT applied automatically, stock validated & decremented in a single transaction
- 📦 **Inventory with audit trail** — every entry/exit is logged (initial stock, purchases, adjustments, losses, sales, voids); low-stock alerts with configurable minimums
- ↔️ **Void & restock** — cancel a sale (admin only) and stock flows back, fully logged
- 👥 **Customers** — optional customer on each sale, search by name or phone
- 📊 **Dashboard analytics** — sales today/month, 14-day series, top products, low-stock list
- 🔐 **JWT auth with roles** — exactly **one administrator (the owner)** per installation + cashiers linked to the owner; passwords hashed with argon2
- 🧪 **Tested** — 26-test pytest suite covering auth, products, stock movements, sales and dashboard
- 🐳 **One command to run** — Docker Compose (web + API + PostgreSQL)

## 🧰 Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query · Recharts |
| API | FastAPI · SQLAlchemy 2.0 · Pydantic v2 |
| DB | PostgreSQL (Docker/prod) · SQLite (local dev) |
| Auth | JWT (PyJWT) · argon2 (pwdlib) |
| Tooling | pytest · oxlint · Docker Compose · GitHub Actions |

## 🚀 Quickstart

### Docker (recommended)

```bash
docker compose up --build
# Web UI  → http://localhost:3000
# API docs → http://localhost:8000/docs
```

### Local development

```bash
# 1. Backend (http://127.0.0.1:8000)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
SEED_ON_STARTUP=true python -m uvicorn app.main:app --reload

# 2. Frontend (http://localhost:5173, proxy /api → :8000)
cd ../frontend
npm install
npm run dev
```

### Demo credentials (created by the seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin (owner) | `admin@novus.dev` | `Admin123*` |
| Cashier | `caja@novus.dev` | `Caja123*` |
| Cashier 2 | `caja2@novus.dev` | `Caja123*` |

> ℹ️ Each installation has exactly **one administrator** (the owner). Cashiers are created from the **Users** section and stay linked to the owner — they cannot see or manage users.
> ⚠️ Demo data only — change these before any real deployment (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## 🧪 Tests

```bash
cd backend && python -m pytest -q   # 26 tests
cd frontend && npm run build        # type-check + production build
```

## 🔌 API overview

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login` · `GET /api/auth/me` |
| Products | CRUD + `POST /api/products/{id}/stock-adjust` · `GET /api/products/{id}/movements` |
| Customers | CRUD with search |
| Sales | `POST /api/sales` · list/detail · `POST /api/sales/{id}/void` (admin) |
| Dashboard | `summary` · `sales-series` · `top-products` · `low-stock` |
| Users | admin-only: list · create linked cashiers · update/deactivate (single admin per installation) |

Full interactive reference at `/docs` (OpenAPI/Swagger).

## 🗺️ Roadmap

- [x] Backend API: sales, inventory, dashboard, roles & tests
- [x] Web UI (React + TypeScript): POS screen, products, sales, customers, dashboard
- [ ] Live demo
- [ ] WhatsApp orders — incoming orders flow straight into the POS (pairs with [whatsapp-ai-agent](https://github.com/987rafa/whatsapp-ai-agent))

## 📄 License

MIT © [Rafael Álvarez · NOVUS DEV](https://github.com/987rafa)
