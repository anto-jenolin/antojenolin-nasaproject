import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Satellite, Globe, Lock, User, Shield, UserCircle, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

type LoginMode = 'user' | 'admin'

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/'

  const [mode, setMode] = useState<LoginMode>('user')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // If already authenticated, redirect away from login page
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [loading, isAuthenticated, navigate, from])

  const handleModeSwitch = (newMode: LoginMode) => {
    if (newMode === 'admin') {
      navigate('/admin/login')
      return
    }
    setMode(newMode)
    setUsername('')
    setPassword('')
    setShowPassword(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('Please enter username and password')
      return
    }
    setSubmitting(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Login failed. Check credentials.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-root">
      {/* Earth background */}
      <div className="login-bg" />
      <div className="login-overlay" />

      {/* Animated particles */}
      <div className="login-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 53 + 7) % 100}%`,
            animationDelay: `${(i * 0.3) % 5}s`,
            animationDuration: `${3 + (i % 4)}s`,
          }} />
        ))}
      </div>

      {/* Card */}
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <Satellite size={24} />
          </div>
          <h1 className="login-title">
            <span className="gradient-text">TerraPulse</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> AI</span>
          </h1>
          <p className="login-subtitle">Welcome back</p>
        </div>

        {/* Login type selector */}
        <div className="login-type-selector">
          <button
            type="button"
            className={`login-type-btn ${mode === 'user' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('user')}
            aria-pressed={mode === 'user'}
          >
            <UserCircle size={20} />
            <span>User Login</span>
          </button>
          <button
            type="button"
            className={`login-type-btn ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('admin')}
            aria-pressed={mode === 'admin'}
          >
            <Shield size={20} />
            <span>Admin Login</span>
          </button>
        </div>

        {/* Stats pills */}
        <div className="login-stats">
          <div className="login-stat-pill">
            <Globe size={12} />
            <span>319 Months</span>
          </div>
          <div className="login-stat-pill">
            <span>8.27B Observations</span>
          </div>
          <div className="login-stat-pill">
            <span>Feb 2000 – Present</span>
          </div>
        </div>

        {/* Form */}
        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            onSubmit={handleSubmit}
            className="login-form"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="login-username">
                {mode === 'admin' ? 'Admin Username or Email' : 'Username or Email'}
              </label>
              <div className="input-icon-wrap">
                <User size={15} className="input-icon" />
                <input
                  id="login-username"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  placeholder={mode === 'admin' ? 'admin' : 'Enter your username'}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: 38, paddingRight: 40 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={submitting}
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
              id="login-submit"
              type="submit"
              className={`btn btn-lg ${mode === 'admin' ? 'btn-admin' : 'btn-primary'}`}
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={submitting}
            >
              {submitting ? (
                <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Signing In…</>
              ) : (
                <><Satellite size={16} /> Sign In to TerraPulse</>
              )}
            </button>
          </motion.form>
        </AnimatePresence>

        {/* Register CTA — only for regular users */}
        {mode === 'user' && (
          <div className="login-register-cta">
            <p className="login-register-text">Don't have an account?</p>
            <button
              type="button"
              className="btn btn-ghost login-register-btn"
              onClick={() => navigate('/register')}
            >
              Create New Account <ArrowRight size={15} />
            </button>
          </div>
        )}

        <p className="login-footer">
          NASA MODIS MOD13C2 Collection 6.1 · Global 0.05° CMG Grid
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
        .login-overlay {
          position: fixed; inset: 0;
          background: linear-gradient(
            135deg,
            rgba(7,17,31,0.85) 0%,
            rgba(7,17,31,0.65) 50%,
            rgba(11,31,51,0.8) 100%
          );
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
        .login-title { font-size: 1.9rem; margin-bottom: 4px; }
        .login-subtitle {
          font-size: 1rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 0;
        }
        /* Login type selector */
        .login-type-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 20px;
          background: var(--deep-space);
          border-radius: 14px;
          padding: 6px;
          border: 1px solid var(--border-subtle);
        }
        .login-type-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .login-type-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
        }
        .login-type-btn.active {
          background: var(--cyan);
          color: var(--midnight-navy);
          box-shadow: 0 4px 12px rgba(54,214,231,0.3);
        }
        .login-stats {
          display: flex; gap: 8px; justify-content: center;
          flex-wrap: wrap; margin-bottom: 24px;
        }
        .login-stat-pill {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 12px;
          background: var(--cyan-dim);
          border: 1px solid rgba(54,214,231,0.25);
          border-radius: 20px;
          font-size: 0.72rem;
          color: var(--cyan);
          font-weight: 600;
        }
        .login-form { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
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
        /* Admin button style */
        .btn-admin {
          background: linear-gradient(135deg, #7C4DFF, #5B2EDB);
          color: #fff;
          border: none;
          box-shadow: 0 4px 14px rgba(124,77,255,0.35);
        }
        .btn-admin:hover:not(:disabled) {
          background: linear-gradient(135deg, #9C6DFF, #7C4DFF);
          box-shadow: 0 6px 18px rgba(124,77,255,0.45);
        }
        /* Register CTA */
        .login-register-cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
          margin-bottom: 20px;
        }
        .login-register-text {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin: 0;
        }
        .login-register-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--cyan);
          font-size: 0.9rem;
          font-weight: 600;
          border: 1px solid rgba(54,214,231,0.3);
          padding: 8px 20px;
          border-radius: 8px;
          width: 100%;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .login-register-btn:hover {
          background: var(--cyan-dim);
          border-color: var(--cyan);
        }
        .login-footer { text-align: center; font-size: 0.72rem; color: var(--text-disabled); }

        @media (max-width: 480px) {
          .login-card { padding: 28px 20px; }
          .login-type-btn span { display: none; }
          .login-type-btn { padding: 12px; }
        }
      `}</style>
    </div>
  )
}
