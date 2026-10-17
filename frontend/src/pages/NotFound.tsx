import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-4 text-center">
      <p className="text-6xl font-extrabold text-slate-300">404</p>
      <h1 className="text-lg font-bold text-slate-700">Página no encontrada</h1>
      <Link to="/">
        <Button>Volver al inicio</Button>
      </Link>
    </div>
  )
}
