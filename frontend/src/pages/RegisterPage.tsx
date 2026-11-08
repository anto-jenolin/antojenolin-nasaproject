import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { Eye, EyeOff, Satellite, Globe, Lock, User, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function RegisterPage() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim()) { toast.error('Username is required'); return }
    if (username.trim().length < 3) { toast.error('Username must be at least 3 characters'); return }
    if (!email.trim()) { toast.error('Email is required'); return }
    if (!validateEmail(email.trim())) { toast.error('Enter a valid email address'); return }
    if (!password) { toast.error('Password is required'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }

    setLoading(true)
    try {
      await authApi.register(username.trim(), email.trim(), password)
      setSuccess(true)
      toast.success('Account created! Please sign in.')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Registration failed. Try a different username or email.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-bg" />
      <div className="login-overlay" />

      <div className="login-particles">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${(i * 43 + 17) % 100}%`,
            top: `${(i * 67 + 11) % 100}%`,
            animationDelay: `${(i * 0.35) % 5}s`,
            animationDuration: `${3 + (i % 4)}s`,
          }} />
        ))}
      </div>

      <motion.div
        className="login-card"
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
          <ArrowLeft size={14} /> Back to Login
        </button>

        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <Satellite size={24} />
          </div>
          <h1 className="login-title">
            <span className="gradient-text">TerraPulse</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> AI</span>
          </h1>
          <p className="login-subtitle">Create your account</p>
          <p className="login-desc">Access 319 months of NASA MODIS vegetation data</p>
        </div>

        {/* Stats pills */}
        <div className="login-stats">
          <div className="login-stat-pill"><Globe size={12} /><span>Free Access</span></div>
          <div className="login-stat-pill"><span>User Role</span></div>
          <div className="login-stat-pill"><span>Secure JWT Auth</span></div>
        </div>

        {success ? (
          <motion.div
            className="register-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <CheckCircle size={48} style={{ color: 'var(--sci-green)', marginBottom: 12 }} />
            <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>Account Created!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 20 }}>
              Your TerraPulse AI account is ready. Sign in to start exploring NASA satellite data.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate('/login')}
            >
              <Satellite size={16} /> Go to Login
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">Username</label>
              <div className="input-icon-wrap">
                <User size={15} className="input-icon" />
                <input
                  id="reg-username"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="Choose a username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                  minLength={3}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email address</label>
              <div className="input-icon-wrap">
                <Mail size={15} className="input-icon" />
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: 38, paddingRight: 40 }}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={8}
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

            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className="form-input"
                  style={{
                    paddingLeft: 38,
                    paddingRight: 40,
                    borderColor: confirmPassword && password !== confirmPassword
                      ? 'var(--coral)' : undefined,
                  }}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p style={{ fontSize: '0.75rem', color: 'var(--coral)', marginTop: 4 }}>
                  Passwords do not match.
                </p>
              )}
            </div>

            <div className="reg-role-notice">
              <CheckCircle size={13} style={{ color: 'var(--sci-green)', flexShrink: 0 }} />
              <span>New accounts are created as <strong>regular users</strong>. Administrator access is granted separately.</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading || (!!confirmPassword && password !== confirmPassword)}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Creating Account…</>
              ) : (
                <><Satellite size={16} /> Create Account</>
              )}
            </button>
          </form>
        )}

        <p className="login-footer" style={{ marginTop: 16 }}>
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
          background: linear-gradient(135deg, rgba(7,17,31,0.85) 0%, rgba(7,17,31,0.65) 50%, rgba(11,31,51,0.8) 100%);
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
        .login-title { font-size: 1.9rem; margin-bottom: 4px; }
        .login-subtitle { font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
        .login-desc { font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; margin: 0; }
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
        .login-form { display: flex; flex-direction: column; gap: 14px; }
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
        .reg-role-notice {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(124,231,165,0.06);
          border: 1px solid rgba(124,231,165,0.2);
          border-radius: 8px;
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .reg-role-notice strong { color: var(--sci-green); }
        .register-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 8px 0 4px;
        }
        .login-footer { text-align: center; font-size: 0.72rem; color: var(--text-disabled); }

        @media (max-width: 480px) {
          .login-card { padding: 28px 20px; }
        }
      `}</style>
    </div>
  )
}
