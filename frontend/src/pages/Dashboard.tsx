import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CreditCard, Package, TrendingUp, Users } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../components/PageHeader'
import { Badge, stockTone } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { api } from '../lib/api'
import { cop, copCompact } from '../lib/format'
import type { DashboardSummary, LowStockItem, SalesSeries, TopProducts } from '../lib/types'
import type { ReactNode } from 'react'

function pointLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  tone: 'indigo' | 'emerald' | 'amber' | 'slate'
}) {
  const toneClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
  }
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">{value}</p>
      <p className="text-xs text-slate-400">{hint}</p>
    </Card>
  )
}

export function Dashboard() {
  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
  })
  const series = useQuery({
    queryKey: ['dashboard', 'series'],
    queryFn: () => api.get<SalesSeries>('/dashboard/sales-series?days=14'),
  })
  const top = useQuery({
    queryKey: ['dashboard', 'top'],
    queryFn: () => api.get<TopProducts>('/dashboard/top-products?days=30&limit=5'),
  })
  const low = useQuery({
    queryKey: ['dashboard', 'low'],
    queryFn: () => api.get<LowStockItem[]>('/dashboard/low-stock?limit=8'),
  })

  if (summary.isPending || series.isPending || top.isPending || low.isPending) {
    return <Spinner label="Cargando dashboard…" />
  }
  if (!summary.data) {
    return <p className="text-sm text-rose-600">No se pudo cargar el dashboard.</p>
  }

  const s = summary.data
  const seriesData = (series.data?.points ?? []).map((point) => ({
    label: pointLabel(point.date),
    total_cents: point.total_cents,
  }))
  const topItems = top.data?.items ?? []
  const lowItems = low.data ?? []

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Resumen del negocio en tiempo real"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={<CreditCard className="size-5" />}
          label="Ventas de hoy"
          value={cop(s.sales_today_cents)}
          hint={`${s.sales_today_count} ${s.sales_today_count === 1 ? 'venta' : 'ventas'}`}
          tone="indigo"
        />
        <Stat
          icon={<TrendingUp className="size-5" />}
          label="Ventas del mes"
          value={cop(s.sales_month_cents)}
          hint={`${s.sales_month_count} ventas`}
          tone="emerald"
        />
        <Stat
          icon={<Package className="size-5" />}
          label="Productos activos"
          value={String(s.products_count)}
          hint={s.low_stock_count > 0 ? `${s.low_stock_count} con stock bajo` : 'Inventario saludable'}
          tone={s.low_stock_count > 0 ? 'amber' : 'slate'}
        />
        <Stat
          icon={<Users className="size-5" />}
          label="Clientes"
          value={String(s.customers_count)}
          hint="registrados"
          tone="slate"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ventas últimos 14 días" subtitle="Total diario de ventas completadas" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={seriesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => copCompact(Number(value))}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip formatter={(value) => cop(Number(value))} />
                <Area
                  type="monotone"
                  dataKey="total_cents"
                  name="Ventas"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Más vendidos" subtitle="Últimos 30 días" />
          <div className="divide-y divide-slate-100">
            {topItems.map((item, index) => (
              <div key={item.product_id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.qty} unidades</p>
                </div>
                <span className="text-sm font-semibold text-slate-700">{cop(item.total_cents)}</span>
              </div>
            ))}
            {topItems.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">Aún no hay ventas registradas.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Stock bajo"
          subtitle="Productos en o por debajo del mínimo"
          action={
            s.low_stock_count > 0 ? (
              <Badge tone="amber">
                <AlertTriangle className="size-3" /> {s.low_stock_count} alertas
              </Badge>
            ) : (
              <Badge tone="emerald">Todo en orden</Badge>
            )
          }
        />
        {lowItems.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">
            Sin alertas — todo el inventario tiene stock suficiente ✅
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Producto</th>
                  <th className="px-5 py-3 font-semibold">Stock</th>
                  <th className="px-5 py-3 font-semibold">Mínimo</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowItems.map((item) => (
                  <tr key={item.product_id}>
                    <td className="px-5 py-3 font-medium text-slate-700">{item.name}</td>
                    <td className="px-5 py-3">
                      <Badge tone={stockTone(item.stock, item.min_stock)}>{item.stock} uds</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{item.min_stock} uds</td>
                    <td className="px-5 py-3 text-slate-500">
                      {item.stock <= 0 ? 'Agotado' : 'Reponer pronto'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
