import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Globe, Database, Brain, Zap, MessageSquare, ArrowRight,
  Satellite, TrendingUp, Clock, FileStack, Activity
} from 'lucide-react'
import { datasetApi } from '../api/client'
import GlassCard from '../components/shared/GlassCard'

interface DatasetStats {
  total_files: number
  total_size_gb: number
  temporal_coverage: { start: string; end: string; months: number }
  variables: string[]
  product: string
  spatial_resolution: string
}

const QUICK_ACTIONS = [
  { label: 'Explore Earth', desc: 'Visualise global vegetation on the 3D globe', icon: Globe, path: '/explorer', color: 'var(--cyan)' },
  { label: 'Data Lab', desc: 'Preview dataset, inspect schema and quality', icon: Database, path: '/data-lab', color: 'var(--sci-green)' },
  { label: 'Train a Model', desc: 'Build regression models from satellite data', icon: Brain, path: '/ml-studio', color: 'var(--purple)' },
  { label: 'AI Copilot', desc: 'Ask questions about vegetation and data', icon: MessageSquare, path: '/copilot', color: 'var(--amber)' },
]

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <motion.div
      className="stat-card stat-card-accent"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}20`,
          border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          <Icon size={18} />
        </div>
        <span className="stat-card-label">{label}</span>
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </motion.div>
  )
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DatasetStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    datasetApi.stats()
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="app-shell">
      <div style={{ marginTop: 'var(--nav-height)' }}>
        {/* Hero */}
        <div className="overview-hero">
          <div className="overview-hero-bg" />
          <div className="overview-hero-content">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="overview-badge">
                <span className="notif-dot" />
                <span>NASA MODIS MOD13C2 · Live Dataset</span>
              </div>
              <h1 style={{ marginBottom: 16, marginTop: 16 }}>
                Understand Earth.<br />
                <span className="gradient-text">Anticipate Change.</span>
              </h1>
              <p style={{ fontSize: '1.1rem', maxWidth: 560, marginBottom: 32 }}>
                AI-powered vegetation intelligence from 26 years of NASA MODIS satellite data.
                Explore global NDVI patterns, train predictive models, and gain explainable insights.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/explorer')}>
                  <Globe size={18} /> Launch Earth Explorer
                </button>
                <button className="btn btn-secondary btn-lg" onClick={() => navigate('/data-lab')}>
                  <Database size={18} /> Open Data Lab
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="page-content">
          {/* Dataset Stats */}
          <section style={{ marginBottom: 40 }}>
            <div className="section-header">
              <h2 className="section-title">Dataset Overview</h2>
            </div>
            {loading ? (
              <div className="grid-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 120 }} />
                ))}
              </div>
            ) : stats ? (
              <div className="grid-4">
                <StatCard
                  icon={FileStack} label="Parquet Files" color="var(--cyan)"
                  value={stats.total_files.toLocaleString()}
                  sub={`${stats.total_size_gb.toFixed(1)} GB compressed`}
                />
                <StatCard
                  icon={Activity} label="Observations" color="var(--sci-green)"
                  value="8.27B"
                  sub="~25.9M rows per monthly file"
                />
                <StatCard
                  icon={Clock} label="Temporal Range" color="var(--amber)"
                  value={`${stats.temporal_coverage?.months} months`}
                  sub={`${stats.temporal_coverage?.start?.slice(0, 7)} → ${stats.temporal_coverage?.end?.slice(0, 7)}`}
                />
                <StatCard
                  icon={Satellite} label="Spatial Resolution" color="var(--purple)"
                  value="0.05°"
                  sub="7200 × 3600 global CMG grid"
                />
              </div>
            ) : (
              <div className="grid-4">
                <StatCard icon={FileStack} label="Parquet Files" color="var(--cyan)" value="319" sub="~31 GB total" />
                <StatCard icon={Activity} label="Observations" color="var(--sci-green)" value="8.27B" sub="25.9M rows per file" />
                <StatCard icon={Clock} label="Temporal Range" color="var(--amber)" value="319 months" sub="Feb 2000 – Aug 2026" />
                <StatCard icon={Satellite} label="Spatial Resolution" color="var(--purple)" value="0.05°" sub="7200 × 3600 CMG grid" />
              </div>
            )}
          </section>

          {/* Variables */}
          {stats?.variables && (
            <section style={{ marginBottom: 40 }}>
              <div className="section-header">
                <h3 className="section-title">Available Variables</h3>
              </div>
              <GlassCard>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {stats.variables.map((v) => (
                    <span key={v} className={`badge ${v === 'NDVI' || v === 'EVI' ? 'badge-cyan' : 'badge-purple'}`}>
                      {v}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </section>
          )}

          {/* Quick Actions */}
          <section>
            <div className="section-header">
              <h3 className="section-title">Quick Actions</h3>
            </div>
            <div className="grid-4">
              {QUICK_ACTIONS.map(({ label, desc, icon: Icon, path, color }, i) => (
                <motion.div
                  key={path}
                  className="quick-action-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  onClick={() => navigate(path)}
                >
                  <div className="qa-icon" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                    <Icon size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="qa-label">{label}</div>
                    <div className="qa-desc">{desc}</div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </motion.div>
              ))}
            </div>
          </section>

          {/* Pipeline overview */}
          <section style={{ marginTop: 40 }}>
            <div className="section-header">
              <h3 className="section-title">Analysis Pipeline</h3>
            </div>
            <GlassCard>
              <div className="pipeline">
                {[
                  { step: '01', label: 'Data Lab', desc: 'Explore & validate', icon: Database },
                  { step: '02', label: 'Preprocessing', desc: 'Clean & transform', icon: Zap },
                  { step: '03', label: 'ML Studio', desc: 'Train & evaluate', icon: Brain },
                  { step: '04', label: 'Explainable AI', desc: 'Interpret results', icon: TrendingUp },
                  { step: '05', label: 'AI Copilot', desc: 'Natural language queries', icon: MessageSquare },
                ].map(({ step, label, desc, icon: Icon }, i) => (
                  <div key={step} className="pipeline-step">
                    <div className="pipeline-num">{step}</div>
                    <Icon size={18} style={{ color: 'var(--cyan)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                    {i < 4 && <div className="pipeline-arrow">→</div>}
                  </div>
                ))}
              </div>
            </GlassCard>
          </section>
        </div>
      </div>

      <style>{`
        .overview-hero {
          position: relative;
          min-height: 420px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border-bottom: 1px solid var(--border-subtle);
        }
        .overview-hero-bg {
          position: absolute; inset: 0;
          background-image: url('/earth_night.png');
          background-size: cover;
          background-position: center 30%;
          filter: brightness(0.25) saturate(1.3);
        }
        .overview-hero-content {
          position: relative; z-index: 1;
          padding: 60px 40px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }
        .overview-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: var(--cyan-dim);
          border: 1px solid rgba(54,214,231,0.3);
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--cyan);
        }
        .quick-action-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          background: var(--panel-blue);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-base);
        }
        .quick-action-card:hover {
          border-color: var(--border-blue);
          background: var(--card-blue);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .qa-icon {
          width: 48px; height: 48px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .qa-label { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); }
        .qa-desc { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
        .pipeline {
          display: flex; align-items: center; gap: 8px;
          flex-wrap: wrap;
        }
        .pipeline-step {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px;
          background: var(--panel-blue);
          border-radius: var(--radius-md);
          flex: 1;
          min-width: 140px;
        }
        .pipeline-num {
          font-size: 0.7rem; font-weight: 700;
          color: var(--cyan); opacity: 0.7;
          font-family: 'JetBrains Mono', monospace;
        }
        .pipeline-arrow {
          font-size: 1.2rem; color: var(--border-blue);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}
