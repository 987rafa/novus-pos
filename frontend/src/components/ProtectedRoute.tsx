import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppLayout } from './AppLayout'

export function ProtectedLayout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <AppLayout />
}
