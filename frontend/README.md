# NOVUS POS — Frontend 🧾

Interfaz web de NOVUS POS (punto de venta e inventario) — **React + TypeScript + Tailwind CSS + TanStack Query + Recharts**.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173 (proxy /api → http://127.0.0.1:8000)
```

El backend debe estar corriendo en `http://127.0.0.1:8000` (ver `../backend`).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Type-check + build de producción a `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run lint` | Linter (oxlint) |

## Funcionalidades

- Login con roles (admin / cajero) y rutas protegidas
- Usuarios (solo admin): dueño único de la instalación + cajeros vinculados a él
- Punto de venta: grilla de productos con fotos, carrito, descuentos, IVA 19 %, métodos de pago (efectivo con recibido/cambio, transferencia, tarjeta) y recibo imprimible
- Escáner de código de barras: el lector USB escribe el código y con Enter el producto entra al carrito (búsqueda exacta por EAN-13 o SKU)
- Productos: CRUD, código de barras, foto del producto (JPG/PNG/WebP, máx. 2 MB), ajustes de stock e historial de movimientos
- Caja: apertura del turno con base inicial, cierre con arqueo (contado vs esperado) e historial de turnos
- Ventas: historial con filtros, detalle (método de pago, recibido y cambio), reimpresión de recibo y anulación (admin)
- Clientes: CRUD con búsqueda
- Dashboard: ventas de hoy/mes, serie de 14 días, top productos y stock bajo

> Documentación general del proyecto en el [README principal](../README.md).
