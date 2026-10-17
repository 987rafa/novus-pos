import { Lock, Mail, Store } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const quickFill = (role: 'admin' | 'cashier') => {
    if (role === 'admin') {
      setEmail('admin@novus.dev')
      setPassword('Admin123*')
    } else {
      setEmail('caja@novus.dev')
      setPassword('Caja123*')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-600/30">
            <Store className="size-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">NOVUS POS</h1>
            <p className="text-sm text-slate-400">Punto de venta e inventario — by NOVUS DEV</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl"
        >
          <h2 className="text-lg font-bold text-slate-800">Iniciar sesión</h2>
          <p className="mb-5 text-xs text-slate-400">Entra con tu cuenta de administrador o cajero</p>

          <div className="space-y-4">
            <Field label="Correo">
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <Input
                  type="email"
                  className="pl-9"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </Field>
            <Field label="Contraseña">
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <Input
                  type="password"
                  className="pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </Field>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={loading} className="mt-5 w-full">
            Entrar
          </Button>

          <div className="mt-5 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Cuentas de demostración
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickFill('admin')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="block font-semibold text-slate-700">Admin</span>
                <span className="text-slate-400">admin@novus.dev</span>
              </button>
              <button
                type="button"
                onClick={() => quickFill('cashier')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="block font-semibold text-slate-700">Cajero</span>
                <span className="text-slate-400">caja@novus.dev</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
