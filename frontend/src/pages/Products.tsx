import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Image as ImageIcon, PackagePlus, Pencil, Plus, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge, stockTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { ApiError, api } from '../lib/api'
import { cop, dateTime } from '../lib/format'
import type { Product, StockMovement } from '../lib/types'

interface ProductFormState {
  sku: string
  barcode: string
  name: string
  category: string
  pricePesos: string
  costPesos: string
  stock: string
  minStock: string
  isActive: boolean
}

const emptyForm: ProductFormState = {
  sku: '',
  barcode: '',
  name: '',
  category: 'General',
  pricePesos: '',
  costPesos: '',
  stock: '0',
  minStock: '5',
  isActive: true,
}

const movementLabels: Record<string, string> = {
  initial: 'Stock inicial',
  purchase: 'Compra',
  adjustment: 'Ajuste',
  loss: 'Merma',
  sale: 'Venta',
  sale_void: 'Anulación de venta',
}

export function Products() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [includeInactive, setIncludeInactive] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [adjustKind, setAdjustKind] = useState<'purchase' | 'adjustment' | 'loss'>('purchase')
  const [adjustQty, setAdjustQty] = useState('1')
  const [adjustNote, setAdjustNote] = useState('')

  const [movementsFor, setMovementsFor] = useState<Product | null>(null)

  const products = useQuery({
    queryKey: ['products', 'list', search, category, includeInactive],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '500' })
      if (search.trim()) params.set('q', search.trim())
      if (category !== 'todas') params.set('category', category)
      if (includeInactive) params.set('include_inactive', 'true')
      return api.get<Product[]>(`/products?${params.toString()}`)
    },
  })

  const categories = useMemo(() => {
    const set = new Set((products.data ?? []).map((product) => product.category))
    if (category !== 'todas') set.add(category)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [products.data, category])

  const movements = useQuery({
    queryKey: ['products', movementsFor?.id, 'movements'],
    queryFn: () => api.get<StockMovement[]>(`/products/${movementsFor?.id}/movements?limit=50`),
    enabled: movementsFor !== null,
  })

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        category: form.category.trim() || 'General',
        price_cents: Math.round(Number(form.pricePesos || '0') * 100),
        cost_cents: Math.round(Number(form.costPesos || '0') * 100),
        min_stock: Math.max(0, Math.round(Number(form.minStock || '0'))),
      }
      let product: Product
      if (editing) {
        product = await api.patch<Product>(`/products/${editing.id}`, {
          ...payload,
          is_active: form.isActive,
        })
      } else {
        product = await api.post<Product>('/products', {
          ...payload,
          stock: Math.max(0, Math.round(Number(form.stock || '0'))),
        })
      }
      if (imageFile) {
        const data = new FormData()
        data.append('file', imageFile)
        product = await api.upload<Product>(`/products/${product.id}/image`, data)
      }
      return product
    },
    onSuccess: (product) => {
      toast.success(editing ? `Producto "${product.name}" actualizado` : `Producto "${product.name}" creado`)
      setFormOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar el producto')
    },
  })

  const adjustStock = useMutation({
    mutationFn: () => {
      const qty = Math.max(1, Math.round(Number(adjustQty || '0')))
      const delta = adjustKind === 'purchase' ? qty : -qty
      return api.post<Product>(`/products/${adjusting?.id}/stock-adjust`, {
        qty_delta: delta,
        reason: adjustKind,
        note: adjustNote.trim() || null,
      })
    },
    onSuccess: (product) => {
      toast.success(`Stock de "${product.name}" actualizado a ${product.stock} uds`)
      setAdjusting(null)
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo ajustar el stock')
    },
  })

  const onPickImage = (file: File | null) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Formato no permitido: usa JPG, PNG o WebP')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2 MB')
      return
    }
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const previewUrl = imagePreview ?? editing?.image_url ?? null

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setImageFile(null)
    setImagePreview(null)
    setFormOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setImageFile(null)
    setImagePreview(null)
    setForm({
      sku: product.sku,
      barcode: product.barcode ?? '',
      name: product.name,
      category: product.category,
      pricePesos: String(Math.round(product.price_cents / 100)),
      costPesos: String(Math.round(product.cost_cents / 100)),
      stock: String(product.stock),
      minStock: String(product.min_stock),
      isActive: product.is_active,
    })
    setFormOpen(true)
  }

  const openAdjust = (product: Product) => {
    setAdjusting(product)
    setAdjustKind('purchase')
    setAdjustQty('1')
    setAdjustNote('')
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Catálogo, inventario y movimientos de stock"
        actions={
          isAdmin ? (
            <Button icon={<Plus className="size-4" />} onClick={openCreate}>
              Nuevo producto
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, SKU o código de barras…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            className="sm:w-56"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="todas">Todas las categorías</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          {isAdmin ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Ver inactivos
            </label>
          ) : null}
        </div>

        {products.isPending ? (
          <Spinner label="Cargando productos…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 font-semibold">Precio</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Mínimo</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(products.data ?? []).map((product) => (
                  <tr key={product.id} className={product.is_active ? '' : 'opacity-60'}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <span className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="size-4 text-slate-300" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            {product.name}
                            {!product.is_active ? <Badge tone="slate">Inactivo</Badge> : null}
                          </span>
                          {product.barcode ? (
                            <span className="block font-mono text-[11px] text-slate-400">
                              {product.barcode}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{product.category}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {cop(product.price_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={stockTone(product.stock, product.min_stock)}>
                        {product.stock} uds
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{product.min_stock} uds</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setMovementsFor(product)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          title="Historial de movimientos"
                        >
                          <History className="size-4" />
                        </button>
                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openAdjust(product)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                              title="Ajustar stock"
                            >
                              <PackagePlus className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(product)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                              title="Editar"
                            >
                              <Pencil className="size-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {(products.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No se encontraron productos.
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
        title={editing ? `Editar ${editing.name}` : 'Nuevo producto'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saveProduct.isPending} onClick={() => saveProduct.mutate()}>
              {editing ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU">
            <Input
              value={form.sku}
              onChange={(event) => setForm({ ...form, sku: event.target.value })}
              placeholder="GAS-400"
            />
          </Field>
          <Field label="Código de barras" hint="Opcional — EAN-13 para el escáner de la caja">
            <Input
              className="font-mono"
              value={form.barcode}
              onChange={(event) => setForm({ ...form, barcode: event.target.value })}
              placeholder="7702001000001"
            />
          </Field>
          <Field label="Nombre">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Gaseosa 400 ml"
            />
          </Field>
          <Field label="Categoría">
            <Input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            />
          </Field>
          <Field label="Precio de venta (COP)">
            <Input
              inputMode="numeric"
              value={form.pricePesos}
              onChange={(event) => setForm({ ...form, pricePesos: event.target.value })}
              placeholder="3500"
            />
          </Field>
          <Field label="Costo (COP)">
            <Input
              inputMode="numeric"
              value={form.costPesos}
              onChange={(event) => setForm({ ...form, costPesos: event.target.value })}
              placeholder="2200"
            />
          </Field>
          <Field label="Stock mínimo">
            <Input
              inputMode="numeric"
              value={form.minStock}
              onChange={(event) => setForm({ ...form, minStock: event.target.value })}
            />
          </Field>
          {editing ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Producto activo (visible para vender)
            </label>
          ) : (
            <Field label="Stock inicial" hint="Se registra como movimiento de inventario">
              <Input
                inputMode="numeric"
                value={form.stock}
                onChange={(event) => setForm({ ...form, stock: event.target.value })}
              />
            </Field>
          )}
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Foto del producto
            </p>
            <div className="flex items-center gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="size-6 text-slate-300" />
                )}
              </div>
              <div className="space-y-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
                  <Upload className="size-4" />
                  {previewUrl ? 'Cambiar imagen' : 'Subir imagen'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => onPickImage(event.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="text-xs text-slate-400">JPG, PNG o WebP · máx. 2 MB</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={adjusting !== null}
        onClose={() => setAdjusting(null)}
        title={`Ajustar stock · ${adjusting?.name ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)}>
              Cancelar
            </Button>
            <Button loading={adjustStock.isPending} onClick={() => adjustStock.mutate()}>
              Aplicar ajuste
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Stock actual: <span className="font-semibold text-slate-700">{adjusting?.stock ?? 0} uds</span>
          </p>
          <Field label="Tipo de movimiento">
            <Select
              value={adjustKind}
              onChange={(event) =>
                setAdjustKind(event.target.value as 'purchase' | 'adjustment' | 'loss')
              }
            >
              <option value="purchase">Compra (entra stock)</option>
              <option value="adjustment">Ajuste manual (sale stock)</option>
              <option value="loss">Merma (sale stock)</option>
            </Select>
          </Field>
          <Field label="Cantidad">
            <Input
              inputMode="numeric"
              value={adjustQty}
              onChange={(event) => setAdjustQty(event.target.value)}
            />
          </Field>
          <Field label="Nota (opcional)">
            <Input
              value={adjustNote}
              onChange={(event) => setAdjustNote(event.target.value)}
              placeholder="Ej: compra a proveedor, producto dañado…"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={movementsFor !== null}
        onClose={() => setMovementsFor(null)}
        title={`Movimientos · ${movementsFor?.name ?? ''}`}
        size="lg"
      >
        {movements.isPending ? (
          <Spinner label="Cargando movimientos…" />
        ) : (
          <div className="divide-y divide-slate-100">
            {(movements.data ?? []).map((movement) => (
              <div key={movement.id} className="flex items-center gap-3 py-2.5">
                <Badge tone={movement.qty_delta > 0 ? 'emerald' : 'rose'}>
                  {movement.qty_delta > 0 ? `+${movement.qty_delta}` : movement.qty_delta}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    {movementLabels[movement.reason] ?? movement.reason}
                  </p>
                  {movement.note ? (
                    <p className="truncate text-xs text-slate-400">{movement.note}</p>
                  ) : null}
                </div>
                <span className="text-xs text-slate-400">{dateTime(movement.created_at)}</span>
              </div>
            ))}
            {(movements.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Sin movimientos.</p>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}
