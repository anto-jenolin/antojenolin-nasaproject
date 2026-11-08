import { useEffect, useState } from 'react'
import {
  Users, Activity, FileText, Shield,
  RefreshCw, CheckCircle, XCircle, Search, Cpu, Brain
} from 'lucide-react'
import { adminApi, mlApi } from '../api/client'
import GlassCard from '../components/shared/GlassCard'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'experiments' | 'jobs' | 'audit' | 'system'>('users')

  // Data states
  const [users, setUsers] = useState<any[]>([])
  const [experiments, setExperiments] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [systemInfo, setSystemInfo] = useState<any>(null)

  // Loading & search
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadAllAdminData()
  }, [])

  const loadAllAdminData = async () => {
    setLoading(true)
    try {
      const [usersRes, expRes, jobsRes, auditRes, systemRes] = await Promise.allSettled([
        adminApi.users(),
        mlApi.experiments(),
        adminApi.jobs(),
        adminApi.auditLogs(),
        adminApi.systemStats(),
      ])

      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || [])
      if (expRes.status === 'fulfilled') setExperiments(expRes.value.data || [])
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.data || [])
      if (auditRes.status === 'fulfilled') setAuditLogs(auditRes.value.data || [])
      if (systemRes.status === 'fulfilled') setSystemInfo(systemRes.value.data || null)
    } catch {
      toast.error('Failed to load administrative records')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredExperiments = experiments.filter(e =>
    e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.model_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.target?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(e.user_id).includes(searchTerm)
  )

  const filteredJobs = jobs.filter(j =>
    j.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.status?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredAudit = auditLogs.filter(a =>
    a.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.detail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.ip?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="app-shell" style={{ marginTop: 'var(--nav-height)', padding: '28px 36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={24} style={{ color: 'var(--cyan)' }} />
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>Administration Console</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            System telemetry, user accounts, trained model experiments, asynchronous job executions, and audit logs.
          </p>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          onClick={loadAllAdminData}
          disabled={loading}
          style={{ border: '1px solid var(--border-blue)' }}
        >
          <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Top summary cards */}
      <div className="grid-4" style={{ gap: 16, marginBottom: 24 }}>
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registered Users</span>
            <Users size={16} style={{ color: 'var(--purple)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 8, color: 'var(--text-primary)' }}>
            {users.length}
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trained Models</span>
            <Brain size={16} style={{ color: 'var(--cyan)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 8, color: 'var(--text-primary)' }}>
            {experiments.length}
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Jobs (History)</span>
            <Activity size={16} style={{ color: 'var(--sci-green)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 8, color: 'var(--text-primary)' }}>
            {jobs.length}
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Audit Logs</span>
            <FileText size={16} style={{ color: 'var(--amber)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 8, color: 'var(--text-primary)' }}>
            {auditLogs.length}
          </div>
        </GlassCard>
      </div>

      {/* Navigation tabs & Search bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="tab-nav" style={{ display: 'flex', gap: 8, margin: 0, border: 'none', padding: 0 }}>
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={14} /> Registered Users ({users.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'experiments' ? 'active' : ''}`}
            onClick={() => setActiveTab('experiments')}
          >
            <Brain size={14} /> Trained Models ({experiments.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            <Activity size={14} /> Execution History ({jobs.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <FileText size={14} /> Data Logs ({auditLogs.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <Cpu size={14} /> System Health
          </button>
        </div>

        {activeTab !== 'system' && (
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={`Filter ${activeTab}…`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 30, fontSize: '0.8rem', height: 34 }}
            />
          </div>
        )}
      </div>

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <GlassCard padding="0">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Account Status</th>
                <th>Registered</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{u.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.username}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-cyan'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                        {u.is_active ? (
                          <>
                            <CheckCircle size={13} style={{ color: 'var(--sci-green)' }} />
                            <span style={{ color: 'var(--sci-green)' }}>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={13} style={{ color: 'var(--coral)' }} />
                            <span style={{ color: 'var(--coral)' }}>Suspended</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.created_at?.slice(0, 16)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.last_login?.slice(0, 16) || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Tab: Trained Models / Experiments */}
      {activeTab === 'experiments' && (
        <GlassCard padding="0">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Author</th>
                <th>Experiment Name</th>
                <th>Model</th>
                <th>Target</th>
                <th>Test R²</th>
                <th>MAE</th>
                <th>RMSE</th>
                <th>Train / Test Samples</th>
                <th>Trained Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredExperiments.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No trained model experiments found.
                  </td>
                </tr>
              ) : (
                filteredExperiments.map(e => {
                  const author = users.find(u => u.id === e.user_id)
                  return (
                    <tr key={e.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{e.id}</td>
                      <td>
                        <span style={{ fontWeight: 500, color: 'var(--cyan)' }}>
                          {author ? author.username : `User #${e.user_id}`}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</td>
                      <td><span className="badge badge-purple">{e.model_type}</span></td>
                      <td><span className="badge badge-cyan">{e.target}</span></td>
                      <td style={{ color: 'var(--sci-green)', fontWeight: 700, fontFamily: 'monospace' }}>
                        {e.r2 !== undefined && e.r2 !== null ? Number(e.r2).toFixed(4) : 'N/A'}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {e.mae !== undefined && e.mae !== null ? Number(e.mae).toFixed(4) : 'N/A'}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {e.rmse !== undefined && e.rmse !== null ? Number(e.rmse).toFixed(4) : 'N/A'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {e.train_samples?.toLocaleString() || 0} / {e.test_samples?.toLocaleString() || 0}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.created_at?.slice(0, 16)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Tab: Jobs / Execution History */}
      {activeTab === 'jobs' && (
        <GlassCard padding="0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Task Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Created At</th>
                <th>Details / Error</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No job executions recorded.
                  </td>
                </tr>
              ) : (
                filteredJobs.map(j => (
                  <tr key={j.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{j.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{j.name || 'Job'}</td>
                    <td><span className="badge badge-purple">{j.type}</span></td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            j.status === 'completed'
                              ? 'var(--sci-green-dim)'
                              : j.status === 'failed'
                              ? 'var(--coral-dim)'
                              : 'var(--amber-dim)',
                          color:
                            j.status === 'completed'
                              ? 'var(--sci-green)'
                              : j.status === 'failed'
                              ? 'var(--coral)'
                              : 'var(--amber)',
                        }}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: 'var(--panel-blue)', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.round((j.progress || 0) * 100)}%`,
                              height: '100%',
                              background: j.status === 'failed' ? 'var(--coral)' : 'var(--cyan)',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          {Math.round((j.progress || 0) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{j.created_at?.slice(0, 16)}</td>
                    <td style={{ fontSize: '0.78rem', color: j.error ? 'var(--coral)' : 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.error || 'Clean run'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Tab: Data Logs / Audit Records */}
      {activeTab === 'audit' && (
        <GlassCard padding="0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>User ID</th>
                <th>Action</th>
                <th>Event Details</th>
                <th>Client IP</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudit.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                filteredAudit.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{a.id}</td>
                    <td style={{ fontFamily: 'monospace' }}>User #{a.user_id}</td>
                    <td><span className="badge badge-cyan">{a.action}</span></td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{a.detail || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.ip || '127.0.0.1'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.created_at?.slice(0, 19)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Tab: System Health */}
      {activeTab === 'system' && (
        <div className="grid-2" style={{ gap: 20 }}>
          <GlassCard>
            <div className="section-title" style={{ marginBottom: 16 }}>Database & Storage Telemetry</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>DuckDB Parquet Directory</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--cyan)' }}>{systemInfo?.dataset?.parquet_dir || 'Auto-resolved'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Partitioned Files Count</span>
                <span style={{ fontWeight: 600 }}>{systemInfo?.dataset?.file_count || 0} monthly partitions</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Archive Footprint</span>
                <span style={{ fontWeight: 600 }}>{systemInfo?.dataset?.total_size_gb || '0'} GB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Relational State Store</span>
                <span style={{ color: 'var(--sci-green)' }}>SQLite WAL (Operational)</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="section-title" style={{ marginBottom: 16 }}>Cognitive & Inference Providers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>LLM Provider Engine</span>
                <span style={{ textTransform: 'capitalize', color: 'var(--cyan)' }}>{systemInfo?.llm?.provider || 'Built-in / OpenAI'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Provider Operational Status</span>
                <span style={{ color: systemInfo?.llm?.configured ? 'var(--sci-green)' : 'var(--amber)' }}>
                  {systemInfo?.llm?.configured ? 'Online (API Connected)' : 'Built-in Science Knowledge Engine Active'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Model Target</span>
                <span style={{ fontFamily: 'monospace' }}>{systemInfo?.llm?.model || 'TerraPulse Science Engine'}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
