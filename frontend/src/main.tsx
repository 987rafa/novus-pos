// oxlint-disable react/only-export-components -- entrypoint: rutas lazy como constantes
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { ProtectedLayout } from './components/ProtectedRoute'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './context/AuthContext'
import { Login } from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Pos = lazy(() => import('./pages/Pos').then((m) => ({ default: m.Pos })))
const Products = lazy(() => import('./pages/Products').then((m) => ({ default: m.Products })))
const Sales = lazy(() => import('./pages/Sales').then((m) => ({ default: m.Sales })))
const Customers = lazy(() => import('./pages/Customers').then((m) => ({ default: m.Customers })))
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
                  Cargando…
                </div>
              }
            >
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="pos" element={<Pos />} />
                  <Route path="productos" element={<Products />} />
                  <Route path="ventas" element={<Sales />} />
                  <Route path="clientes" element={<Customers />} />
                  <Route path="usuarios" element={<Users />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
