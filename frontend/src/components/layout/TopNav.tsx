import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  Globe, BarChart3, Brain, Zap, MessageSquare, BookOpen,
  Shield, Database, LogOut, User, Satellite,
  ChevronDown, Activity, Layers, TrendingUp
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: Activity },
  { path: '/explorer', label: 'Earth Explorer', icon: Globe },
  { path: '/data-lab', label: 'Data Lake', icon: Database },
  { path: '/preprocessing', label: 'Preprocessing', icon: Layers },
  { path: '/ml-studio', label: 'ML Studio', icon: Brain },
  { path: '/predict', label: 'Predict', icon: TrendingUp, highlight: true },
  { path: '/xai', label: 'Explainable AI', icon: Zap },
  { path: '/insights', label: 'Insights', icon: BarChart3 },
  { path: '/copilot', label: 'AI Copilot', icon: MessageSquare },
  { path: '/docs', label: 'Documentation', icon: BookOpen },
]

export default function TopNav() {
  const { user, isAdmin, logout } = useAuth()
  const location = useLocation()
  
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        {/* Logo */}
        <NavLink to="/" className="nav-logo">
          <div className="nav-logo-icon">
            <Satellite size={18} />
          </div>
          <div className="nav-logo-text">
            <span className="nav-logo-primary">TerraPulse</span>
            <span className="nav-logo-secondary gradient-text-cyan">AI</span>
          </div>
        </NavLink>

        {/* Navigation Links */}
        <nav className="nav-links">
          {NAV_ITEMS.map(({ path, label, icon: Icon, highlight }) => {
            const isActive = location.pathname === path

            return (
              <NavLink
                key={path}
                to={path}
                className={`nav-link ${isActive ? 'active' : ''} ${highlight ? 'nav-link-predict' : ''}`}
                end={path === '/'}
              >
                <Icon size={15} />
                <span>{label}</span>
              </NavLink>
            )
          })}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Shield size={15} />
              <span>Admin</span>
            </NavLink>
          )}
        </nav>

        {/* User Menu */}
        <div className="nav-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
          <div className="nav-user-avatar">
            <User size={14} />
          </div>
          <div className="nav-user-info">
            <span className="nav-user-name">{user?.username}</span>
            <span className="nav-user-role">{user?.role}</span>
          </div>
          <ChevronDown size={14} className={`nav-chevron ${userMenuOpen ? 'open' : ''}`} />

          {userMenuOpen && (
            <div className="nav-dropdown" onClick={e => e.stopPropagation()}>
              <div className="nav-dropdown-header">
                <p className="nav-dropdown-name">{user?.username}</p>
                <p className="nav-dropdown-email">{user?.email}</p>
              </div>
              <hr className="divider" style={{ margin: '4px 0' }} />
              {isAdmin && (
                <NavLink to="/admin" className="nav-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  <Shield size={14} /> Administration
                </NavLink>
              )}
              <button className="nav-dropdown-item danger" onClick={logout}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .top-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: var(--nav-height);
          background: rgba(7, 17, 31, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-subtle);
          z-index: 1000;
        }
        .top-nav-inner {
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 20px;
          gap: 4px;
          max-width: 1800px;
          margin: 0 auto;
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          margin-right: 16px;
          flex-shrink: 0;
        }
        .nav-logo-icon {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, var(--cyan) 0%, #1BA8B6 100%);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: var(--midnight-navy);
        }
        .nav-logo-text { display: flex; gap: 3px; align-items: baseline; }
        .nav-logo-primary {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary);
        }
        .nav-logo-secondary {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 800;
          font-size: 1rem;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 2px;
          flex: 1;
          overflow-x: auto;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted);
          text-decoration: none;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }
        .nav-link:hover { color: var(--text-secondary); background: var(--panel-blue); }
        .nav-link.active {
          color: var(--cyan);
          background: var(--cyan-dim);
        }
        .nav-link-predict {
          border: 1px solid rgba(54, 214, 231, 0.25);
          background: rgba(54, 214, 231, 0.05);
        }
        .nav-link-predict:hover {
          border-color: var(--cyan);
          background: rgba(54, 214, 231, 0.15);
        }
        .nav-user {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          position: relative;
          border: 1px solid var(--border-subtle);
          background: var(--panel-blue);
          transition: border-color var(--transition-fast);
          flex-shrink: 0;
          margin-left: 8px;
        }
        .nav-user:hover { border-color: var(--border-blue); }
        .nav-user-avatar {
          width: 28px; height: 28px;
          background: var(--cyan-dim);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--cyan);
          border: 1px solid rgba(54,214,231,0.3);
        }
        .nav-user-info { display: flex; flex-direction: column; }
        .nav-user-name { font-size: 0.8rem; font-weight: 600; color: var(--text-primary); }
        .nav-user-role { font-size: 0.68rem; color: var(--text-muted); text-transform: capitalize; }
        .nav-chevron { color: var(--text-muted); transition: transform var(--transition-fast); }
        .nav-chevron.open { transform: rotate(180deg); }
        .nav-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 200px;
          background: var(--card-blue);
          border: 1px solid var(--border-blue);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          padding: 8px;
          z-index: 200;
          animation: fadeInUp 0.15s ease;
        }
        .nav-dropdown-header { padding: 8px 10px 4px; }
        .nav-dropdown-name { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); }
        .nav-dropdown-email { font-size: 0.75rem; color: var(--text-muted); }
        .nav-dropdown-item {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 8px 10px;
          border-radius: 6px;
          font-size: 0.85rem; font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: none; cursor: pointer;
          text-decoration: none;
          transition: all var(--transition-fast);
        }
        .nav-dropdown-item:hover { background: var(--panel-blue); color: var(--text-primary); }
        .nav-dropdown-item.danger:hover { background: var(--coral-dim); color: var(--coral); }
      `}</style>
    </header>
  )
}
