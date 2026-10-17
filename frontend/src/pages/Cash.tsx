import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { ApiError, api } from '../lib/api'
import { cop, dateTime } from '../lib/format'
import type { CashSession, CashStatus } from '../lib/types'

export function Cash() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [openingPesos, setOpeningPesos] = useState('')
  const [countedPesos, setCountedPesos] = useState('')
  const [note, setNote] = useState('')

  const status = useQuery({
    queryKey: ['cash', 'status'],
    queryFn: () => api.get<CashStatus>('/cash/status'),
  })

  const history = useQuery({
    queryKey: ['cash', 'sessions'],
    queryFn: () => api.get<CashSession[]>('/cash/sessions?limit=20'),
  })

  const openCash = useMutation({
    mutationFn: () =>
      api.post<CashSession>('/cash/open', {
        opening_cents: Math.round(Number(openingPesos.replace(/[^\d]/g, '') || '0') * 100),
      }),
    onSuccess: () => {
      toast.success('Caja abierta — turno iniciado')
      setOpenModal(false)
      setOpeningPesos('')
      void queryClient.invalidateQueries({ queryKey: ['cash'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo abrir la caja')
    },
  })

  const closeCash = useMutation({
    mutationFn: () =>
      api.post<CashSession>('/cash/close', {
        counted_cents: Math.round(Number(countedPesos.replace(/[^\d]/g, '') || '0') * 100),
        note: note.trim() || null,
      }),
    onSuccess: (session) => {
      const diff = session.difference_cents ?? 0
      if (diff === 0) {
        toast.success('Caja cerrada — el arqueo cuadró perfecto')
      } else if (diff > 0) {
        toast.success(`Caja cerrada — sobrante de ${cop(diff)}`)
      } else {
        toast.error(`Caja cerrada — faltante de ${cop(-diff)}`)
      }
      setCloseModal(false)
      setCountedPesos('')
      setNote('')
      void queryClient.invalidateQueries({ queryKey: ['cash'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo cerrar la caja')
    },
  })

  const data = status.data
  const isOpen = data?.is_open ?? false
  const session = data?.session ?? null

  return (
    <div>
      <PageHeader title="Caja" subtitle="Apertura, arqueo al cierre e historial de turnos" />

      {status.isPending ? (
        <Spinner label="Cargando estado de caja…" />
      ) : isOpen ? (
        <Card className="mb-6">
          <CardHeader
            title="Caja abierta"
            subtitle={`${session?.opened_by_name ?? '—'} · desde ${session ? dateTime(session.opened_at) : ''}`}
          />
          <div className="p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <p className="text-xs uppercase tracking-wide text-slate-400">Base inicial</p>
                <p className="mt-1 text-lg font-bold text-slate-800">
                  {cop(session?.opening_cents ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Ventas en efectivo ({data?.cash_sales_count ?? 0})
                </p>
                <p className="mt-1 text-lg font-bold text-slate-800">
                  {cop(data?.cash_sales_cents ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-4 ring-1 ring-inset ring-indigo-100">
                <p className="text-xs uppercase tracking-wide text-indigo-400">Esperado en caja</p>
                <p className="mt-1 text-lg font-bold text-indigo-700">
                  {cop(data?.expected_cents ?? 0)}
                </p>
              </div>
            </div>
            <Button
              className="mt-5"
              variant="danger"
              icon={<Lock className="size-4" />}
              onClick={() => {
                setCountedPesos('')
                setNote('')
                setCloseModal(true)
              }}
            >
              Cerrar caja (arqueo)
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader
            title="Caja cerrada"
            subtitle="Abre el turno con la base inicial en efectivo para dar cambio"
          />
          <div className="p-5">
            <Button icon={<LockOpen className="size-4" />} onClick={() => setOpenModal(true)}>
              Abrir caja
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Historial de turnos" subtitle="Últimos 20 cierres de caja" />
        {history.isPending ? (
          <Spinner label="Cargando historial…" />
        ) : (history.data ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            Aún no hay turnos registrados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Turno</th>
                  <th className="px-4 py-3 font-semibold">Abrió</th>
                  <th className="px-4 py-3 font-semibold">Cerró</th>
                  <th className="px-4 py-3 font-semibold">Base</th>
                  <th className="px-4 py-3 font-semibold">Esperado</th>
                  <th className="px-4 py-3 font-semibold">Contado</th>
                  <th className="px-4 py-3 font-semibold">Diferencia</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(history.data ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold text-slate-700">#{item.id}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.opened_by_name}
                      <span className="block text-xs text-slate-400">
                        {dateTime(item.opened_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.closed_by_name ?? '—'}
                      {item.closed_at ? (
                        <span className="block text-xs text-slate-400">
                          {dateTime(item.closed_at)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{cop(item.opening_cents)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.expected_cents !== null ? cop(item.expected_cents) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.counted_cents !== null ? cop(item.counted_cents) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {item.difference_cents === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <Badge
                          tone={
                            item.difference_cents === 0
                              ? 'emerald'
                              : item.difference_cents > 0
                                ? 'amber'
                                : 'rose'
                          }
                        >
                          {item.difference_cents === 0
                            ? 'Cuadró'
                            : `${item.difference_cents > 0 ? '+' : '−'}${cop(Math.abs(item.difference_cents))}`}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'open' ? (
                        <Badge tone="indigo">Abierta</Badge>
                      ) : (
                        <Badge tone="slate">Cerrada</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Abrir caja"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button loading={openCash.isPending} onClick={() => openCash.mutate()}>
              Abrir turno
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Ingresa el efectivo con el que inicia el turno (la base para dar cambio).
          </p>
          <Field label="Base inicial (COP)">
            <Input
              inputMode="numeric"
              placeholder="0"
              value={openingPesos}
              onChange={(event) => setOpeningPesos(event.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={closeModal}
        onClose={() => setCloseModal(false)}
        title="Cerrar caja (arqueo)"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseModal(false)}>
              Cancelar
            </Button>
            <Button loading={closeCash.isPending} onClick={() => closeCash.mutate()}>
              Cerrar turno
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-inset ring-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Base inicial</span>
              <span className="font-medium text-slate-700">{cop(session?.opening_cents ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ventas en efectivo</span>
              <span className="font-medium text-slate-700">{cop(data?.cash_sales_cents ?? 0)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
              <span className="font-semibold text-slate-600">Esperado en caja</span>
              <span className="font-bold text-indigo-700">{cop(data?.expected_cents ?? 0)}</span>
            </div>
          </div>
          <Field label="¿Cuánto dinero hay en caja? (COP)" hint="Cuenta los billetes y monedas reales">
            <Input
              inputMode="numeric"
              placeholder="0"
              value={countedPesos}
              onChange={(event) => setCountedPesos(event.target.value)}
            />
          </Field>
          <Field label="Nota (opcional)">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej: turno de la tarde…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
