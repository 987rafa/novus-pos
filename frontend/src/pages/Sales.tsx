import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Eye, XCircle } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { ApiError, api } from '../lib/api'
import { cop, dateTime } from '../lib/format'
import type { Sale, SaleList } from '../lib/types'

const limit = 20

export function Sales() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const toast = useToast()

  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState<Sale | null>(null)

  const sales = useQuery({
    queryKey: ['sales', status, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
      if (status) params.set('status', status)
      return api.get<SaleList>(`/sales?${params.toString()}`)
    },
  })

  const voidSale = useMutation({
    mutationFn: (sale: Sale) => api.post<Sale>(`/sales/${sale.id}/void`),
    onSuccess: (sale) => {
      toast.success(`Venta #${sale.id} anulada — el stock volvió al inventario`)
      setVoiding(null)
      setSelected(null)
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo anular la venta')
    },
  })

  const data = sales.data
  const from = data && data.total > 0 ? Math.min(offset + 1, data.total) : 0
  const to = data ? Math.min(offset + limit, data.total) : 0

  return (
    <div>
      <PageHeader title="Ventas" subtitle="Historial de ventas registradas en caja" />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Select
            className="sm:w-56"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setOffset(0)
            }}
          >
            <option value="">Todas las ventas</option>
            <option value="completed">Completadas</option>
            <option value="voided">Anuladas</option>
          </Select>
          <p className="text-xs text-slate-400">
            Mostrando {from}–{to} de {data?.total ?? 0}
          </p>
        </div>

        {sales.isPending ? (
          <Spinner label="Cargando ventas…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Cajero</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Unidades</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.items ?? []).map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-4 py-3 font-semibold text-slate-700">{sale.id}</td>
                    <td className="px-4 py-3 text-slate-500">{dateTime(sale.created_at)}</td>
                    <td className="px-4 py-3 text-slate-500">{sale.cashier_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{sale.customer?.name ?? 'Ocasional'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {sale.items.reduce((sum, item) => sum + item.qty, 0)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {cop(sale.total_cents)}
                    </td>
                    <td className="px-4 py-3">
                      {sale.status === 'completed' ? (
                        <Badge tone="emerald">Completada</Badge>
                      ) : (
                        <Badge tone="rose">Anulada</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelected(sale)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          title="Ver detalle"
                        >
                          <Eye className="size-4" />
                        </button>
                        {isAdmin && sale.status === 'completed' ? (
                          <button
                            type="button"
                            onClick={() => setVoiding(sale)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Anular venta"
                          >
                            <XCircle className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      No hay ventas que mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronLeft className="size-4" />}
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={to >= (data?.total ?? 0)}
            onClick={() => setOffset(offset + limit)}
          >
            Siguiente <ChevronRight className="size-4" />
          </Button>
        </div>
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`Venta #${selected?.id ?? ''}`}
        size="lg"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Fecha</p>
                <p className="font-medium text-slate-700">{dateTime(selected.created_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Cajero</p>
                <p className="font-medium text-slate-700">{selected.cashier_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Cliente</p>
                <p className="font-medium text-slate-700">
                  {selected.customer?.name ?? 'Ocasional'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Estado</p>
                {selected.status === 'completed' ? (
                  <Badge tone="emerald">Completada</Badge>
                ) : (
                  <Badge tone="rose">Anulada</Badge>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Producto</th>
                    <th className="px-4 py-2.5 font-semibold">Cant.</th>
                    <th className="px-4 py-2.5 font-semibold">Precio</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5 text-slate-700">{item.product_name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{item.qty}</td>
                      <td className="px-4 py-2.5 text-slate-500">{cop(item.unit_price_cents)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                        {cop(item.line_total_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{cop(selected.subtotal_cents)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Descuento</span>
                <span>− {cop(selected.discount_cents)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>IVA (19 %)</span>
                <span>{cop(selected.tax_cents)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold text-slate-800">
                <span>Total</span>
                <span>{cop(selected.total_cents)}</span>
              </div>
            </div>

            {isAdmin && selected.status === 'completed' ? (
              <Button
                variant="danger"
                className="w-full"
                icon={<XCircle className="size-4" />}
                onClick={() => {
                  setVoiding(selected)
                  setSelected(null)
                }}
              >
                Anular venta y reponer stock
              </Button>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title={`Anular venta #${voiding?.id ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoiding(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={voidSale.isPending}
              onClick={() => voiding && voidSale.mutate(voiding)}
            >
              Sí, anular venta
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Esta acción marca la venta como <span className="font-semibold">anulada</span> y devuelve
          todos los productos al inventario. Queda registrada en el historial de movimientos.
        </p>
      </Modal>
    </div>
  )
}
