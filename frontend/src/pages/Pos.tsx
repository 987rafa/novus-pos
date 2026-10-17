import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge, stockTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { ApiError, api } from '../lib/api'
import { cop } from '../lib/format'
import type { Customer, Product, Sale } from '../lib/types'

interface CartLine {
  product: Product
  qty: number
}

export function Pos() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [customerId, setCustomerId] = useState('')
  const [discountPesos, setDiscountPesos] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])

  const products = useQuery({
    queryKey: ['products', 'pos'],
    queryFn: () => api.get<Product[]>('/products?limit=500'),
  })
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
  })

  const categories = useMemo(() => {
    const set = new Set((products.data ?? []).map((product) => product.category))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [products.data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (products.data ?? []).filter((product) => {
      const matchesCategory = category === 'todas' || product.category === category
      const matchesTerm =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term)
      return matchesCategory && matchesTerm
    })
  }, [products.data, search, category])

  const cartQty = (productId: number) => cart.find((line) => line.product.id === productId)?.qty ?? 0

  const addToCart = (product: Product) => {
    setCart((lines) => {
      const existing = lines.find((line) => line.product.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) return lines
        return lines.map((line) =>
          line.product.id === product.id ? { ...line, qty: line.qty + 1 } : line,
        )
      }
      return [...lines, { product, qty: 1 }]
    })
  }

  const updateQty = (product: Product, qty: number) => {
    if (qty <= 0) {
      setCart((lines) => lines.filter((line) => line.product.id !== product.id))
      return
    }
    setCart((lines) =>
      lines.map((line) =>
        line.product.id === product.id ? { ...line, qty: Math.min(qty, product.stock) } : line,
      ),
    )
  }

  const removeLine = (productId: number) => {
    setCart((lines) => lines.filter((line) => line.product.id !== productId))
  }

  const subtotal = cart.reduce((sum, line) => sum + line.product.price_cents * line.qty, 0)
  const discount = Math.min(
    Math.round(Number(discountPesos.replace(/[^\d]/g, '') || '0') * 100),
    subtotal,
  )
  const taxable = subtotal - discount
  const tax = Math.round(taxable * 0.19)
  const total = taxable + tax

  const checkout = useMutation({
    mutationFn: () =>
      api.post<Sale>('/sales', {
        customer_id: customerId ? Number(customerId) : null,
        discount_cents: discount,
        items: cart.map((line) => ({ product_id: line.product.id, qty: line.qty })),
      }),
    onSuccess: (sale) => {
      toast.success(`Venta #${sale.id} registrada · ${cop(sale.total_cents)}`)
      setCart([])
      setDiscountPesos('')
      setCustomerId('')
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar la venta')
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  return (
    <div>
      <PageHeader
        title="Punto de venta"
        subtitle="Selecciona productos, ajusta cantidades y cobra la venta"
      />

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre o SKU…"
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
          </div>

          {products.isPending ? (
            <Spinner label="Cargando productos…" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((product) => {
                const inCart = cartQty(product.id)
                const soldOut = product.stock <= 0
                const atMax = inCart >= product.stock
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={soldOut || atMax}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800">{product.name}</span>
                      <Badge tone={stockTone(product.stock, product.min_stock)}>
                        {product.stock} uds
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-400">
                      {product.category} · {product.sku}
                    </span>
                    <span className="text-base font-bold text-indigo-600">
                      {cop(product.price_cents)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {!products.isPending && filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No se encontraron productos con ese filtro.
            </p>
          ) : null}
        </div>

        <aside className="w-full shrink-0 xl:w-96">
          <Card className="xl:sticky xl:top-8">
            <CardHeader
              title="Venta actual"
              subtitle={
                cart.length > 0
                  ? `${cart.reduce((sum, line) => sum + line.qty, 0)} unidades`
                  : 'Carrito vacío'
              }
            />
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Cliente">
                  <Select
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                  >
                    <option value="">Cliente ocasional</option>
                    {(customers.data ?? []).map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Descuento (COP)">
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={discountPesos}
                    onChange={(event) => setDiscountPesos(event.target.value)}
                  />
                </Field>
              </div>

              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {cart.map((line) => (
                  <div key={line.product.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {line.product.name}
                      </p>
                      <p className="text-xs text-slate-400">{cop(line.product.price_cents)} / ud</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(line.product, line.qty - 1)}
                        className="flex size-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                        aria-label="Quitar uno"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold text-slate-700">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(line.product, line.qty + 1)}
                        disabled={line.qty >= line.product.stock}
                        className="flex size-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                        aria-label="Agregar uno"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="w-20 text-right text-sm font-semibold text-slate-700">
                      {cop(line.product.price_cents * line.qty)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.product.id)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Quitar del carrito"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                {cart.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Haz clic en un producto para agregarlo
                  </p>
                ) : null}
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{cop(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Descuento</span>
                  <span>− {cop(discount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>IVA (19 %)</span>
                  <span>{cop(tax)}</span>
                </div>
                <div className="flex justify-between pt-2 text-base font-bold text-slate-800">
                  <span>Total</span>
                  <span>{cop(total)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                disabled={cart.length === 0}
                loading={checkout.isPending}
                icon={<CreditCard className="size-4" />}
                onClick={() => checkout.mutate()}
              >
                {cart.length === 0 ? 'Agrega productos' : `Cobrar ${cop(total)}`}
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
