<div align="center">

# NOVUS POS 🧾

**Punto de venta e inventario para tiendas — by [NOVUS DEV](https://github.com/987rafa)**

[![CI](https://github.com/987rafa/novus-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/987rafa/novus-pos/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-25d366)

</div>

API de punto de venta e inventario para negocios pequeños (tiendas, panaderías, minimercados): registra ventas con carrito, mantén el stock bajo control con historial completo de movimientos y mira el negocio en un dashboard en tiempo real.

> 🇬🇧 [Read in English](README.md) · 🚧 Interfaz web (React + TypeScript) en construcción

## ✨ Funcionalidades

- 🛒 **Ventas con carrito** — múltiples productos por venta, descuentos, IVA 19 % automático, stock validado y descontado en una sola transacción
- 📦 **Inventario con auditoría** — cada entrada/salida queda registrada (stock inicial, ajustes, ventas, anulaciones); alertas de stock bajo configurables
- ↔️ **Anular y reponer** — cancela una venta (solo admin) y el stock vuelve solo, con registro
- 👥 **Clientes** — cliente opcional por venta, búsqueda por nombre o teléfono
- 📊 **Dashboard** — ventas de hoy/mes, serie de 14 días, productos más vendidos, lista de stock bajo
- 🔐 **Login con roles** — `admin` / `cajero`, contraseñas con argon2
- 🧪 **Con pruebas** — suite de pytest sobre auth, productos, movimientos, ventas y dashboard
- 🐳 **Un comando y listo** — Docker Compose (API + PostgreSQL)

## 🧰 Stack

| Capa | Tecnología |
| --- | --- |
| API | FastAPI · SQLAlchemy 2.0 · Pydantic v2 |
| BD | PostgreSQL (Docker/producción) · SQLite (desarrollo) |
| Auth | JWT (PyJWT) · argon2 (pwdlib) |
| Herramientas | pytest · Docker Compose · GitHub Actions |
| Frontend | React + TypeScript *(en camino)* |

## 🚀 Arranque rápido

### Docker (recomendado)

```bash
docker compose up --build
# Documentación de la API → http://localhost:8000/docs
```

### Local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env                  # ajusta si hace falta
SEED_ON_STARTUP=true python -m uvicorn app.main:app --reload
# o sembrar manualmente: python -m app.seed
```

### Credenciales demo (creadas por el seed)

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Admin | `admin@novus.dev` | `Admin123*` |
| Cajero | `caja@novus.dev` | `Caja123*` |

> ⚠️ Solo para demo — cámbialas antes de usarlo en serio.

## 🧪 Pruebas

```bash
cd backend && python -m pytest -q
```

## 🔌 Resumen de la API

| Área | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login` · `GET /api/auth/me` |
| Productos | CRUD + `POST /api/products/{id}/stock-adjust` · `GET /api/products/{id}/movements` |
| Clientes | CRUD con búsqueda |
| Ventas | `POST /api/sales` · listado/detalle · `POST /api/sales/{id}/void` (admin) |
| Dashboard | `summary` · `sales-series` · `top-products` · `low-stock` |
| Usuarios | CRUD solo admin |

Referencia interactiva completa en `/docs` (OpenAPI/Swagger).

## 🗺️ Roadmap

- [x] API backend: ventas, inventario, dashboard, roles y pruebas
- [ ] Interfaz web (React + TypeScript): pantalla de caja, productos, dashboard
- [ ] Demo en vivo
- [ ] Pedidos por WhatsApp — los pedidos entran solos al POS (se conecta con [whatsapp-ai-agent](https://github.com/987rafa/whatsapp-ai-agent))

## 📄 Licencia

MIT © [Rafael Álvarez · NOVUS DEV](https://github.com/987rafa)
