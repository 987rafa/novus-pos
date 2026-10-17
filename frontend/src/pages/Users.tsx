import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Pencil, Plus, Power, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { ApiError, api } from '../lib/api'
import { dateTime, initials } from '../lib/format'
import type { User } from '../lib/types'

interface CashierFormState {
  name: string
  email: string
  password: string
}

const emptyForm: CashierFormState = { name: '', email: '', password: '' }

export function Users() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<CashierFormState>(emptyForm)

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
    enabled: isAdmin,
  })

  const owner = (users.data ?? []).find((item) => item.role === 'admin')
  const cashiers = (users.data ?? []).filter((item) => item.role === 'cashier')

  const canSave =
    form.name.trim().length > 0 &&
    (editing
      ? form.password.trim().length === 0 || form.password.trim().length >= 6
      : form.email.trim().length > 0 && form.password.trim().length >= 6)

  const saveCashier = useMutation({
    mutationFn: () => {
      if (editing) {
        const payload: { name: string; password?: string } = { name: form.name.trim() }
        if (form.password.trim()) payload.password = form.password.trim()
        return api.patch<User>(`/users/${editing.id}`, payload)
      }
      return api.post<User>('/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
      })
    },
    onSuccess: (saved) => {
      toast.success(
        editing ? `Cajero "${saved.name}" actualizado` : `Cajero "${saved.name}" creado y vinculado`,
      )
      setFormOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar el cajero')
    },
  })

  const toggleActive = useMutation({
    mutationFn: (target: User) => api.patch<User>(`/users/${target.id}`, { is_active: !target.is_active }),
    onSuccess: (saved) => {
      toast.success(saved.is_active ? `"${saved.name}" activado` : `"${saved.name}" desactivado`)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo cambiar el estado')
    },
  })

  if (!isAdmin) return <Navigate to="/" replace />

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (cashier: User) => {
    setEditing(cashier)
    setForm({ name: cashier.name, email: cashier.email, password: '' })
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Un administrador por instalación · cajeros vinculados al dueño"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={openCreate}>
            Agregar cajero
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="Administrador (dueño)"
          subtitle="Cuenta única de esta instalación — no editable"
        />
        <div className="flex items-center gap-4 p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600">
            {owner ? initials(owner.name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              {owner?.name ?? '—'} <ShieldCheck className="size-4 text-indigo-500" />
            </p>
            <p className="text-xs text-slate-400">{owner?.email ?? ''}</p>
          </div>
          <Badge tone="indigo">Administrador</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`Cajeros vinculados (${cashiers.length})`}
          subtitle={`Todos pertenecen a ${owner?.name ?? 'el administrador'}`}
        />
        {users.isPending ? (
          <Spinner label="Cargando usuarios…" />
        ) : users.isError ? (
          <p className="px-5 py-6 text-sm text-rose-600">No se pudieron cargar los usuarios.</p>
        ) : cashiers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            Aún no hay cajeros. Crea el primero con “Agregar cajero”.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cajero</th>
                  <th className="px-4 py-3 font-semibold">Correo</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Creado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashiers.map((cashier) => (
                  <tr key={cashier.id}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                          {initials(cashier.name)}
                        </span>
                        <span className="font-medium text-slate-700">{cashier.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{cashier.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={cashier.is_active ? 'emerald' : 'slate'}>
                        {cashier.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{dateTime(cashier.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(cashier)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                          title="Editar"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive.mutate(cashier)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          title={cashier.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <Power className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Editar cajero · ${editing.name}` : 'Agregar cajero'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saveCashier.isPending} disabled={!canSave} onClick={() => saveCashier.mutate()}>
              {editing ? 'Guardar cambios' : 'Crear cajero'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 ring-1 ring-inset ring-indigo-100">
            <Link2 className="size-3.5 shrink-0" />
            {editing
              ? 'Cajero vinculado al administrador de la instalación.'
              : `Quedará vinculado automáticamente a ${owner?.name ?? 'el administrador'}.`}
          </p>
          <Field label="Nombre">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Camila Cajera"
            />
          </Field>
          <Field label="Correo">
            <Input
              type="email"
              value={form.email}
              disabled={Boolean(editing)}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="cajero@tienda.com"
            />
          </Field>
          <Field label={editing ? 'Nueva contraseña' : 'Contraseña'} hint={editing ? 'Déjalo vacío para no cambiarla' : 'Mínimo 6 caracteres'}>
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="••••••••"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
