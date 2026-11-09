import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Shield, Satellite, Lock, User, ArrowLeft, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function AdminLoginPage() {
  const { login, isAdmin, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already logged in as admin, redirect immediately
  React.useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/admin', { replace: true })
    }
  }, [isAuthenticated, isAdmin, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Please enter your administrator username and password.')
      return
    }

    setLoading(true)
    try {
      await login(username.trim(), password)

      // After login() resolves, decode the token synchronously to check role
      const token = localStorage.getItem('access_token')
      if (!token) {
        setError('Login succeeded but token not found.')
        setLoading(false)
        return
      }

      let role = ''
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        role = payload.role ?? ''
      } catch {
        // malformed token — let ProtectedRoute handle it
        role = 'unknown'
      }

      if (role !== 'admin') {
        // Not an admin — clear tokens and show error
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setError(
          'Your account does not have administrator privileges. Please use the regular login page.'
        )
        setLoading(false)
        return
      }

      toast.success('Administrator login successful')
      navigate('/admin', { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Login failed. Check your credentials.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-bg admin-login-bg" />
      <div className="login-overlay admin-overlay" />

      {/* Particles */}
      <div className="login-particles">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="particle admin-particle" style={{
            left: `${(i * 47 + 13) % 100}%`,
            top: `${(i * 61 + 9) % 100}%`,
            animationDelay: `${(i * 0.4) % 5}s`,
            animationDuration: `${3 + (i % 4)}s`,
          }} />
        ))}
      </div>

      <motion.div
        className="login-card admin-card"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Back link */}
        <button
          type="button"
          className="admin-back-btn"
          onClick={() => navigate('/login')}
        >
          <ArrowLeft size={14} /> Back to User Login
        </button>

        {/* Header */}
        <div className="login-header">
          <div className="login-logo admin-logo">
            <Shield size={24} />
          </div>
          <h1 className="login-title">
            <span style={{ background: 'linear-gradient(135deg, #A78BFA, #7C4DFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              TerraPulse
            </span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> AI</span>
          </h1>
          <p className="login-subtitle" style={{ color: 'var(--text-secondary)' }}>Administrator Portal</p>
          <p className="login-desc">Restricted access — verified administrator credentials required.</p>
        </div>

        {/* Error banner */}
        {error && (
          <motion.div
            className="admin-error-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-username">
              Administrator Username or Email
            </label>
            <div className="input-icon-wrap">
              <User size={15} className="input-icon" />
              <input
                id="admin-username"
                type="text"
                className="form-input"
                style={{ paddingLeft: 38 }}
                placeholder="admin"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                autoComplete="username"
                autoFocus
                disabled={loading}
                aria-describedby={error ? 'admin-error' : undefined}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <div className="input-icon-wrap">
              <Lock size={15} className="input-icon" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: 38, paddingRight: 40 }}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-lg btn-admin-submit"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Authenticating…</>
            ) : (
              <><Satellite size={16} /> Sign In as Administrator</>
            )}
          </button>
        </form>

        <div className="admin-security-note">
          <Shield size={12} />
          <span>Role is verified server-side. Credentials are never stored in the browser.</span>
        </div>

        <p className="login-footer">
          NASA MODIS MOD13C2 Collection 6.1 · Administrator Access
        </p>
      </motion.div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 20px;
        }
        .login-bg {
          position: fixed; inset: 0;
          background-image: url('/earth_day.png');
          background-size: cover;
          background-position: center;
          filter: saturate(1.1) brightness(0.5);
          transform: scale(1.05);
        }
        .admin-login-bg {
          filter: saturate(0.4) brightness(0.35) hue-rotate(230deg);
        }
        .login-overlay {
          position: fixed; inset: 0;
          background: linear-gradient(135deg, rgba(7,17,31,0.85) 0%, rgba(7,17,31,0.65) 50%, rgba(11,31,51,0.8) 100%);
        }
        .admin-overlay {
          background: linear-gradient(135deg, rgba(12,5,30,0.88) 0%, rgba(20,10,50,0.72) 50%, rgba(10,5,30,0.85) 100%);
        }
        .login-particles { position: fixed; inset: 0; pointer-events: none; }
        .particle {
          position: absolute;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: var(--cyan);
          opacity: 0.4;
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .admin-particle { background: #A78BFA; }
        .login-card {
          position: relative; z-index: 10;
          width: 100%; max-width: 440px;
          background: rgba(11, 31, 51, 0.80);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          padding: 36px 40px;
          box-shadow: var(--shadow-lg), var(--shadow-cyan);
        }
        .admin-card {
          border-color: rgba(124,77,255,0.3);
          box-shadow: var(--shadow-lg), 0 0 40px rgba(124,77,255,0.15);
        }
        .admin-back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.8rem;
          cursor: pointer;
          padding: 0;
          margin-bottom: 20px;
          font-family: inherit;
          transition: color 0.2s;
        }
        .admin-back-btn:hover { color: var(--text-secondary); }
        .login-header { text-align: center; margin-bottom: 20px; }
        .login-logo {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, var(--cyan), #1BA8B6);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          color: var(--midnight-navy);
          margin: 0 auto 14px;
          box-shadow: var(--shadow-cyan);
        }
        .admin-logo {
          background: linear-gradient(135deg, #7C4DFF, #5B2EDB);
          box-shadow: 0 4px 20px rgba(124,77,255,0.4);
          color: #fff;
        }
        .login-title { font-size: 1.9rem; margin-bottom: 4px; }
        .login-subtitle { font-size: 1rem; font-weight: 600; margin-bottom: 6px; }
        .login-desc { font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; margin: 0; }
        /* Error banner */
        .admin-error-banner {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(255,82,82,0.1);
          border: 1px solid rgba(255,82,82,0.3);
          border-radius: 10px;
          color: #FF7070;
          font-size: 0.83rem;
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .admin-error-banner svg { flex-shrink: 0; margin-top: 1px; }
        /* Form */
        .login-form { display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px; }
        .input-icon-wrap { position: relative; }
        .input-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: var(--text-muted); pointer-events: none;
        }
        .input-icon-right {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: transparent; border: none; cursor: pointer;
          color: var(--text-muted); padding: 4px;
          transition: color var(--transition-fast);
        }
        .input-icon-right:hover { color: var(--text-secondary); }
        .btn-admin-submit {
          background: linear-gradient(135deg, #7C4DFF, #5B2EDB);
          color: #fff;
          border: none;
          box-shadow: 0 4px 14px rgba(124,77,255,0.35);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-admin-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #9C6DFF, #7C4DFF);
          box-shadow: 0 6px 18px rgba(124,77,255,0.45);
        }
        .btn-admin-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        /* Security note */
        .admin-security-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.72rem;
          color: var(--text-disabled);
          margin-bottom: 16px;
        }
        .login-footer { text-align: center; font-size: 0.72rem; color: var(--text-disabled); }

        @media (max-width: 480px) {
          .login-card { padding: 28px 20px; }
        }
      `}</style>
    </div>
  )
}
