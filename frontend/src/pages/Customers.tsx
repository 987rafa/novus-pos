import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { ApiError, api } from '../lib/api'
import { dateTime } from '../lib/format'
import type { Customer } from '../lib/types'

interface CustomerFormState {
  name: string
  phone: string
  email: string
  notes: string
}

const emptyForm: CustomerFormState = { name: '', phone: '', email: '', notes: '' }

export function Customers() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerFormState>(emptyForm)
  const [deleting, setDeleting] = useState<Customer | null>(null)

  const customers = useQuery({
    queryKey: ['customers', search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '500' })
      if (search.trim()) params.set('q', search.trim())
      return api.get<Customer[]>(`/customers?${params.toString()}`)
    },
  })

  const saveCustomer = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (editing) return api.patch<Customer>(`/customers/${editing.id}`, payload)
      return api.post<Customer>('/customers', payload)
    },
    onSuccess: (customer) => {
      toast.success(editing ? `Cliente "${customer.name}" actualizado` : `Cliente "${customer.name}" creado`)
      setFormOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar el cliente')
    },
  })

  const deleteCustomer = useMutation({
    mutationFn: (customer: Customer) => api.delete<void>(`/customers/${customer.id}`),
    onSuccess: () => {
      toast.success('Cliente eliminado')
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo eliminar el cliente')
      setDeleting(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      notes: customer.notes ?? '',
    })
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Directorio de clientes de la tienda"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={openCreate}>
            Nuevo cliente
          </Button>
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre o teléfono…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {customers.isPending ? (
          <Spinner label="Cargando clientes…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold">Correo</th>
                  <th className="px-4 py-3 font-semibold">Notas</th>
                  <th className="px-4 py-3 font-semibold">Registrado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(customers.data ?? []).map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3 font-medium text-slate-700">{customer.name}</td>
                    <td className="px-4 py-3 text-slate-500">{customer.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{customer.email ?? '—'}</td>
                    <td className="max-w-52 truncate px-4 py-3 text-slate-500">
                      {customer.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{dateTime(customer.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(customer)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                          title="Editar"
                        >
                          <Pencil className="size-4" />
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setDeleting(customer)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Eliminar"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {(customers.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No hay clientes que mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Editar ${editing.name}` : 'Nuevo cliente'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saveCustomer.isPending} onClick={() => saveCustomer.mutate()}>
              {editing ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="María Fernanda Ríos"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono">
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="+57 310 000 0000"
              />
            </Field>
            <Field label="Correo">
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="cliente@correo.com"
              />
            </Field>
          </div>
          <Field label="Notas">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Cliente frecuente, paga quincenal…"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Eliminar ${deleting?.name ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={deleteCustomer.isPending}
              onClick={() => deleting && deleteCustomer.mutate(deleting)}
            >
              Sí, eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          ¿Seguro que quieres eliminar este cliente? Esta acción no se puede deshacer. Si tiene
          ventas asociadas, no se podrá eliminar.
        </p>
      </Modal>
    </div>
  )
}
