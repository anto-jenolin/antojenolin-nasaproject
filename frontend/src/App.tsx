import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { RegionProvider } from './contexts/RegionContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import ChatbotWidget from './components/ChatbotWidget'
import TopNav from './components/layout/TopNav'

// ── Eagerly loaded (above the fold) ──────────────────────────────────────────
import LoginPage from './pages/LoginPage'
import AdminLoginPage from './pages/AdminLoginPage'
import RegisterPage from './pages/RegisterPage'
import OverviewPage from './pages/OverviewPage'

// ── Lazy loaded pages ─────────────────────────────────────────────────────────
const EarthExplorerPage = lazy(() => import('./pages/EarthExplorerPage'))
const DataLabPage = lazy(() => import('./pages/DataLabPage'))
const PreprocessingPage = lazy(() => import('./pages/PreprocessingPage'))
const MLStudioPage = lazy(() => import('./pages/MLStudioPage'))
const PredictPage = lazy(() => import('./pages/PredictPage'))
const ExplainableAIPage = lazy(() => import('./pages/ExplainableAIPage'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const AICopilotPage = lazy(() => import('./pages/AICopilotPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'))

// ── Full-page loading fallback ─────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: 16,
      background: 'var(--midnight-navy)',
    }}>
      <div className="spinner spinner-lg" />
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading TerraPulse AI…</p>
    </div>
  )
}

// ── App shell (with nav) ───────────────────────────────────────────────────
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <TopNav />
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
      {/* Floating chatbot appears on all pages */}
      <ChatbotWidget />
    </div>
  )
}


// ── 404 page ───────────────────────────────────────────────────────────────
function NotFound() {
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
      <h1 style={{ fontSize: '6rem', fontWeight: 900, color: 'var(--border-blue)' }}>404</h1>
      <h2 style={{ color: 'var(--text-secondary)' }}>Page not found</h2>
      <p style={{ color: 'var(--text-muted)' }}>The requested page does not exist.</p>
      <a href="/" className="btn btn-primary" style={{ marginTop: 8 }}>Go to Overview</a>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RegionProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--card-blue)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-blue)',
                borderRadius: '12px',
                fontSize: '0.875rem',
              },
              success: { iconTheme: { primary: 'var(--sci-green)', secondary: 'var(--midnight-navy)' } },
              error: { iconTheme: { primary: 'var(--coral)', secondary: 'var(--midnight-navy)' } },
            }}
          />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes — require authentication */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell><OverviewPage /></AppShell>} path="/" />
              <Route element={<AppShell><EarthExplorerPage /></AppShell>} path="/explorer" />
              <Route element={<AppShell><DataLabPage /></AppShell>} path="/data-lab" />
              <Route element={<AppShell><PreprocessingPage /></AppShell>} path="/preprocessing" />
              <Route element={<AppShell><MLStudioPage /></AppShell>} path="/ml-studio" />
              <Route element={<AppShell><PredictPage /></AppShell>} path="/predict" />
              <Route element={<AppShell><ExplainableAIPage /></AppShell>} path="/xai" />
              <Route element={<AppShell><InsightsPage /></AppShell>} path="/insights" />
              <Route element={<AppShell><AICopilotPage /></AppShell>} path="/copilot" />
              <Route element={<AppShell><DocumentationPage /></AppShell>} path="/docs" />
            </Route>

            {/* Admin-only route */}
            <Route element={<ProtectedRoute requireAdmin />}>
              <Route element={<AppShell><AdminPage /></AppShell>} path="/admin" />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<AppShell><NotFound /></AppShell>} />
          </Routes>
        </RegionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
