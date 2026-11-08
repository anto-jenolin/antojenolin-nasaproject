import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  requireAdmin?: boolean
}

export default function ProtectedRoute({ requireAdmin = false }: Props) {
  const { isAuthenticated, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--midnight-navy)',
      }}>
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '80vh',
        gap: 16,
        textAlign: 'center',
      }}>
        <h2 style={{ color: 'var(--coral)' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-muted)' }}>Administrator privileges are required to view this page.</p>
        <a href="/" className="btn btn-secondary">Return to Overview</a>
      </div>
    )
  }

  return <Outlet />
}
