import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Eye, Globe, MessageCircle, Store, XCircle } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { methodLabels } from '../components/Receipt'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { ApiError, api } from '../lib/api'
import { cop, dateTime } from '../lib/format'
import type { Order, OrderChannel, OrderList, OrderStatus } from '../lib/types'

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  rejected: 'Rechazado',
}

const statusTones: Record<OrderStatus, 'amber' | 'emerald' | 'rose'> = {
  pending: 'amber',
  confirmed: 'emerald',
  rejected: 'rose',
}

const channelLabels: Record<OrderChannel, string> = {
  whatsapp: 'WhatsApp',
  web: 'Web',
  mostrador: 'Mostrador',
}

const channelIcons = {
  whatsapp: MessageCircle,
  web: Globe,
  mostrador: Store,
} as const

export function Orders() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [status, setStatus] = useState('pending')
  const [selected, setSelected] = useState<Order | null>(null)
  const [confirming, setConfirming] = useState<Order | null>(null)
  const [rejecting, setRejecting] = useState<Order | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [reason, setReason] = useState('')

  const orders = useQuery({
    queryKey: ['orders', status],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' })
      if (status) params.set('status', status)
      return api.get<OrderList>(`/orders?${params.toString()}`)
    },
    // Los pedidos entrantes se refrescan solos mientras haya vista de pendientes
    refetchInterval: status === 'pending' || status === '' ? 15_000 : false,
  })

  const confirmOrder = useMutation({
    mutationFn: (order: Order) => {
      const received = cashReceived.trim() === '' ? null : Math.round(Number(cashReceived) * 100)
      return api.post<Order>(`/orders/${order.id}/confirm`, {
        payment_method: paymentMethod,
        cash_received_cents: paymentMethod === 'cash' && received !== null && Number.isFinite(received) ? received : null,
      })
    },
    onSuccess: (order) => {
      toast.success(`Pedido #${order.id} confirmado — venta #${order.sale_id} registrada`)
      setConfirming(null)
      setSelected(null)
      setPaymentMethod('cash')
      setCashReceived('')
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['cash'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo confirmar el pedido')
    },
  })

  const rejectOrder = useMutation({
    mutationFn: (order: Order) =>
      api.post<Order>(`/orders/${order.id}/reject`, { reason: reason.trim() || null }),
    onSuccess: (order) => {
      toast.success(`Pedido #${order.id} rechazado`)
      setRejecting(null)
      setSelected(null)
      setReason('')
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo rechazar el pedido')
    },
  })

  const data = orders.data

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle="Pedidos entrantes de WhatsApp y web — confírmalos para convertirlos en venta"
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Select
            className="sm:w-56"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="pending">Pendientes</option>
            <option value="">Todos los pedidos</option>
            <option value="confirmed">Confirmados</option>
            <option value="rejected">Rechazados</option>
          </Select>
          <p className="text-xs text-slate-400">
            {data?.total ?? 0} pedido{(data?.total ?? 0) === 1 ? '' : 's'} · se actualiza solo cada 15 s
          </p>
        </div>

        {orders.isPending ? (
          <Spinner label="Cargando pedidos…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Recibido</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Canal</th>
                  <th className="px-4 py-3 font-semibold">Ítems</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.items ?? []).map((order) => {
                  const ChannelIcon = channelIcons[order.channel]
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-semibold text-slate-700">{order.id}</td>
                      <td className="px-4 py-3 text-slate-500">{dateTime(order.created_at)}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {order.customer_name}
                        {order.customer_phone ? (
                          <span className="block text-[11px] text-slate-400">{order.customer_phone}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <ChannelIcon className="size-4" />
                          {channelLabels[order.channel]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {order.items.reduce((sum, item) => sum + item.qty, 0)} ítems
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{cop(order.total_cents)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTones[order.status]}>{statusLabels[order.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelected(order)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            title="Ver detalle"
                          >
                            <Eye className="size-4" />
                          </button>
                          {order.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentMethod('cash')
                                  setCashReceived('')
                                  setConfirming(order)
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                                title="Confirmar pedido"
                              >
                                <CheckCircle2 className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReason('')
                                  setRejecting(order)
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                title="Rechazar pedido"
                              >
                                <XCircle className="size-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {(data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      No hay pedidos que mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`Pedido #${selected?.id ?? ''}`}
        size="lg"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Recibido</p>
                <p className="font-medium text-slate-700">{dateTime(selected.created_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Cliente</p>
                <p className="font-medium text-slate-700">{selected.customer_name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Canal</p>
                <p className="font-medium text-slate-700">{channelLabels[selected.channel]}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Estado</p>
                <Badge tone={statusTones[selected.status]}>{statusLabels[selected.status]}</Badge>
              </div>
            </div>

            {selected.customer_phone || selected.note ? (
              <div className="space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                {selected.customer_phone ? (
                  <p className="text-slate-600">
                    <span className="text-slate-400">Teléfono:</span> {selected.customer_phone}
                  </p>
                ) : null}
                {selected.note ? (
                  <p className="text-slate-600">
                    <span className="text-slate-400">Nota:</span> {selected.note}
                  </p>
                ) : null}
              </div>
            ) : null}

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
                <span>IVA (19 %)</span>
                <span>{cop(selected.tax_cents)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold text-slate-800">
                <span>Total</span>
                <span>{cop(selected.total_cents)}</span>
              </div>
            </div>

            {selected.status === 'confirmed' && selected.sale_id !== null ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Confirmado como venta #{selected.sale_id}
                {selected.confirmed_at ? ` · ${dateTime(selected.confirmed_at)}` : ''}
              </p>
            ) : null}
            {selected.status === 'rejected' ? (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Rechazado
                {selected.rejected_at ? ` · ${dateTime(selected.rejected_at)}` : ''}
                {selected.rejected_reason ? ` — ${selected.rejected_reason}` : ''}
              </p>
            ) : null}

            {selected.status === 'pending' ? (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  icon={<CheckCircle2 className="size-4" />}
                  onClick={() => {
                    setPaymentMethod('cash')
                    setCashReceived('')
                    setConfirming(selected)
                    setSelected(null)
                  }}
                >
                  Confirmar pedido
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  icon={<XCircle className="size-4" />}
                  onClick={() => {
                    setReason('')
                    setRejecting(selected)
                    setSelected(null)
                  }}
                >
                  Rechazar
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={`Confirmar pedido #${confirming?.id ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button
              loading={confirmOrder.isPending}
              icon={<CheckCircle2 className="size-4" />}
              onClick={() => confirming && confirmOrder.mutate(confirming)}
            >
              Confirmar y registrar venta
            </Button>
          </>
        }
      >
        {confirming ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              El pedido se registrará como <span className="font-semibold">venta</span> por{' '}
              <span className="font-semibold">{cop(confirming.total_cents)}</span> y se descontará del
              inventario.
            </p>
            <Field label="Método de pago">
              <Select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as 'cash' | 'transfer' | 'card')
                }
              >
                <option value="cash">{methodLabels.cash}</option>
                <option value="transfer">{methodLabels.transfer}</option>
                <option value="card">{methodLabels.card}</option>
              </Select>
            </Field>
            {paymentMethod === 'cash' ? (
              <Field label="Recibido en efectivo (opcional)" hint="Déjalo vacío para registrar el pago justo">
                <Input
                  type="number"
                  min={0}
                  step="100"
                  placeholder={String(confirming.total_cents / 100)}
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Rechazar pedido #${rejecting?.id ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={rejectOrder.isPending}
              onClick={() => rejecting && rejectOrder.mutate(rejecting)}
            >
              Sí, rechazar pedido
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            El pedido queda en el historial como <span className="font-semibold">rechazado</span> y no
            afecta el inventario.
          </p>
          <Field label="Motivo (opcional)">
            <Textarea
              rows={3}
              placeholder="Producto agotado, el cliente no respondió…"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
