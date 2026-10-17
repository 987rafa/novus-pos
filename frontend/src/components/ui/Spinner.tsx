import { Loader2 } from 'lucide-react'

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
      <Loader2 className="size-5 animate-spin" />
      {label}
    </div>
  )
}
