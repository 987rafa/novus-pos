import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  Minus,
  Package,
  Plus,
  ScanLine,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { ReceiptModal } from '../components/Receipt'
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [receivedPesos, setReceivedPesos] = useState('')
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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

  // Lector USB: los escáneres "escriben" el código como un teclado. Si el foco no está
  // en un campo, se enfoca el buscador; escanear/escribir + Enter agrega el producto.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName ?? ''
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return
      if (event.key.length === 1 || event.key === 'Enter') searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  // Escanear/Enter: busca por código exacto (local o API) y agrega al carrito.
  const scanOrSearch = async () => {
    const code = search.trim()
    if (!code) return
    let product =
      (products.data ?? []).find(
        (item) =>
          (item.barcode && item.barcode === code) || item.sku.toLowerCase() === code.toLowerCase(),
      ) ?? null
    if (!product) {
      try {
        product = await api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`)
      } catch {
        product = filtered.length === 1 ? filtered[0] : null
      }
    }
    if (!product) {
      toast.error(`Sin coincidencias para "${code}"`)
      return
    }
    if (product.stock <= 0) {
      toast.error(`"${product.name}" no tiene stock disponible`)
      return
    }
    addToCart(product)
    toast.success(`${product.name} agregado al carrito`)
    setSearch('')
  }

  const subtotal = cart.reduce((sum, line) => sum + line.product.price_cents * line.qty, 0)
  const discount = Math.min(
    Math.round(Number(discountPesos.replace(/[^\d]/g, '') || '0') * 100),
    subtotal,
  )
  const taxable = subtotal - discount
  const tax = Math.round(taxable * 0.19)
  const total = taxable + tax

  const receivedCents = Math.round(Number(receivedPesos.replace(/[^\d]/g, '') || '0') * 100)
  const cashExact = paymentMethod === 'cash' && !receivedPesos.trim()
  const effectiveReceived = paymentMethod === 'cash' ? (cashExact ? total : receivedCents) : null
  const change = effectiveReceived !== null ? effectiveReceived - total : 0
  const cashInsufficient = paymentMethod === 'cash' && !cashExact && receivedCents < total

  const checkout = useMutation({
    mutationFn: () =>
      api.post<Sale>('/sales', {
        customer_id: customerId ? Number(customerId) : null,
        discount_cents: discount,
        payment_method: paymentMethod,
        cash_received_cents: paymentMethod === 'cash' ? effectiveReceived : undefined,
        items: cart.map((line) => ({ product_id: line.product.id, qty: line.qty })),
      }),
    onSuccess: (sale) => {
      toast.success(`Venta #${sale.id} registrada · ${cop(sale.total_cents)}`)
      setCart([])
      setDiscountPesos('')
      setCustomerId('')
      setPaymentMethod('cash')
      setReceivedPesos('')
      setReceiptSale(sale)
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['cash'] })
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
                ref={searchRef}
                className="pl-9 pr-9"
                placeholder="Buscar o escanear código… (Enter agrega)"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void scanOrSearch()
                }}
              />
              <ScanLine className="absolute right-3 top-2.5 size-4 text-slate-300" />
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
                    className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="h-28 w-full bg-slate-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <Package className="size-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
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
                    </div>
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

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Método de pago
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'cash' as const, label: 'Efectivo', icon: Banknote },
                    { value: 'transfer' as const, label: 'Transfer.', icon: ArrowRightLeft },
                    { value: 'card' as const, label: 'Tarjeta', icon: CreditCard },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition ${
                        paymentMethod === value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'cash' ? (
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
                  <Field label="Recibe del cliente (COP)" hint="Déjalo vacío si paga con el monto exacto">
                    <Input
                      inputMode="numeric"
                      placeholder={String(Math.round(total / 100))}
                      value={receivedPesos}
                      onChange={(event) => setReceivedPesos(event.target.value)}
                    />
                  </Field>
                  <div className="mt-2 text-sm">
                    {cashExact ? (
                      <span className="text-slate-500">Pago exacto</span>
                    ) : change >= 0 ? (
                      <span className="font-semibold text-emerald-600">Cambio: {cop(change)}</span>
                    ) : (
                      <span className="font-semibold text-rose-600">Faltan: {cop(-change)}</span>
                    )}
                  </div>
                </div>
              ) : null}

              <Button
                className="w-full"
                disabled={cart.length === 0 || cashInsufficient}
                loading={checkout.isPending}
                icon={<CreditCard className="size-4" />}
                onClick={() => checkout.mutate()}
              >
                {cart.length === 0
                  ? 'Agrega productos'
                  : cashInsufficient
                    ? 'Efectivo insuficiente'
                    : `Cobrar ${cop(total)}`}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      <ReceiptModal sale={receiptSale} open={receiptSale !== null} onClose={() => setReceiptSale(null)} />
    </div>
  )
}
