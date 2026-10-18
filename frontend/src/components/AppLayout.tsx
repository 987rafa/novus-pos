import { useQuery } from '@tanstack/react-query'
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import type { OrderList } from '../lib/types'
import { Badge } from './ui/Badge'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, adminOnly: false },
  { to: '/pos', label: 'Punto de venta', icon: ShoppingCart, end: false, adminOnly: false },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList, end: false, adminOnly: false },
  { to: '/caja', label: 'Caja', icon: Wallet, end: false, adminOnly: false },
  { to: '/productos', label: 'Productos', icon: Package, end: false, adminOnly: false },
  { to: '/ventas', label: 'Ventas', icon: Receipt, end: false, adminOnly: false },
  { to: '/clientes', label: 'Clientes', icon: Users, end: false, adminOnly: false },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, end: false, adminOnly: true },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const pendingOrders = useQuery({
    queryKey: ['orders', 'pending-count'],
    queryFn: () => api.get<OrderList>('/orders?status=pending&limit=1'),
    refetchInterval: 20_000,
    enabled: Boolean(user),
  })
  const pendingCount = pendingOrders.data?.total ?? 0

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-extrabold text-white">
          N
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-wide text-white">NOVUS POS</p>
          <p className="text-[11px] text-slate-500">Punto de venta · NOVUS DEV</p>
        </div>
        <button
          type="button"
          className="ml-auto rounded-lg p-1 text-slate-500 hover:text-white lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {navItems
          .filter(({ adminOnly }) => !adminOnly || user?.role === 'admin')
          .map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-600/90 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="size-4" />
              {label}
              {to === '/pedidos' && pendingCount > 0 ? (
                <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                  {pendingCount}
                </span>
              ) : null}
            </NavLink>
          ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-indigo-300">
            {user ? initials(user.name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <Badge tone={user?.role === 'admin' ? 'indigo' : 'slate'}>
              {user?.role === 'admin' ? 'Administrador' : 'Cajero'}
            </Badge>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-bold text-slate-800">NOVUS POS</span>
        </header>

        <main className="mx-auto max-w-7xl p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
