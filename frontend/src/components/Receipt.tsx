// oxlint-disable react/only-export-components -- methodLabels es compartido con Ventas/POS
import { Printer } from 'lucide-react'
import { cop, dateTime } from '../lib/format'
import type { Sale } from '../lib/types'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

export const methodLabels: Record<Sale['payment_method'], string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
}

/** Tirilla imprimible (id="receipt-print" — el CSS de impresión solo muestra esta zona). */
export function ReceiptView({ sale }: { sale: Sale }) {
  return (
    <div
      id="receipt-print"
      className="mx-auto w-full max-w-xs bg-white font-mono text-[11px] leading-relaxed text-slate-800"
    >
      <div className="border-b border-dashed border-slate-300 pb-3 text-center">
        <p className="text-sm font-bold tracking-widest">NOVUS POS</p>
        <p className="text-slate-500">Punto de venta · NOVUS DEV</p>
      </div>

      <div className="border-b border-dashed border-slate-300 py-3">
        <p>Venta: #{sale.id}</p>
        <p>Fecha: {dateTime(sale.created_at)}</p>
        <p>Atiende: {sale.cashier_name ?? '—'}</p>
        <p>Cliente: {sale.customer?.name ?? 'Ocasional'}</p>
      </div>

      <div className="border-b border-dashed border-slate-300 py-3">
        {sale.items.map((item) => (
          <div key={item.id} className="mb-1.5 last:mb-0">
            <p className="truncate">{item.product_name}</p>
            <div className="flex justify-between text-slate-500">
              <span>
                {item.qty} x {cop(item.unit_price_cents)}
              </span>
              <span className="font-semibold text-slate-800">{cop(item.line_total_cents)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-0.5 border-b border-dashed border-slate-300 py-3">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{cop(sale.subtotal_cents)}</span>
        </div>
        {sale.discount_cents > 0 ? (
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>- {cop(sale.discount_cents)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span>IVA (19 %)</span>
          <span>{cop(sale.tax_cents)}</span>
        </div>
        <div className="flex justify-between pt-1 text-sm font-bold">
          <span>TOTAL</span>
          <span>{cop(sale.total_cents)}</span>
        </div>
      </div>

      <div className="space-y-0.5 py-3">
        <div className="flex justify-between">
          <span>Pago</span>
          <span>{methodLabels[sale.payment_method]}</span>
        </div>
        {sale.cash_received_cents !== null ? (
          <>
            <div className="flex justify-between">
              <span>Recibido</span>
              <span>{cop(sale.cash_received_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cambio</span>
              <span>{cop(sale.change_cents ?? 0)}</span>
            </div>
          </>
        ) : null}
      </div>

      <p className="border-t border-dashed border-slate-300 pt-3 text-center text-slate-500">
        ¡Gracias por su compra!
        <br />
        Conserve este recibo
      </p>
    </div>
  )
}

/** Modal con la tirilla y el botón de imprimir (window.print con CSS de impresión). */
export function ReceiptModal({
  sale,
  open,
  onClose,
}: {
  sale: Sale | null
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal
      open={open && sale !== null}
      onClose={onClose}
      title={`Recibo · Venta #${sale?.id ?? ''}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Imprimir
          </Button>
        </>
      }
    >
      {sale ? <ReceiptView sale={sale} /> : null}
    </Modal>
  )
}
