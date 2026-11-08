import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Brain, Play,
  CheckCircle, Clock, XCircle, RefreshCw, Activity
} from 'lucide-react'
import { mlApi } from '../api/client'
import { useRegion } from '../contexts/RegionContext'
import GlassCard from '../components/shared/GlassCard'
import toast from 'react-hot-toast'

const FEATURE_OPTIONS = [
  'EVI', 'Red_Reflectance', 'NIR_Reflectance', 'Blue_Reflectance',
  'MIR_Reflectance', 'Avg_Sun_Zenith_Angle', 'NDVI_StdDev', 'EVI_StdDev',
]

const MODEL_OPTIONS = [
  { value: 'random_forest', label: 'Random Forest', desc: 'Ensemble of decision trees — robust and interpretable' },
  { value: 'hist_gradient_boosting', label: 'Gradient Boosting', desc: 'Sequential boosting — high accuracy on tabular data' },
  { value: 'ridge', label: 'Ridge Regression', desc: 'L2 regularized linear model — fast baseline' },
  { value: 'baseline_mean', label: 'Baseline (Mean)', desc: 'Predicts target average — benchmark reference' },
]

type JobStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed'

interface JobResult {
  job_id: number
  status: JobStatus
  progress: number
  name: string
  error?: string
  result?: {
    artifact_path: string
    metrics: { mae: number; rmse: number; r2: number }
    features: string[]
    model_type: string
  }
}

export default function MLStudioPage() {
  const { region, dateStart, dateEnd, qualityFilter } = useRegion()

  // Config
  const [modelType, setModelType] = useState('random_forest')
  const [target, setTarget] = useState('NDVI')
  const [features, setFeatures] = useState<string[]>(['EVI', 'NIR_Reflectance', 'Red_Reflectance'])
  const [testSplitDate, setTestSplitDate] = useState('2023-01-01')
  const [maxTrainRows, setMaxTrainRows] = useState(100000)
  const [experimentName, setExperimentName] = useState('ndvi_regression')

  // State
  const [experiments, setExperiments] = useState<any[]>([])
  const [currentJob, setCurrentJob] = useState<JobResult | null>(null)
  const [activeTab, setActiveTab] = useState<'train' | 'experiments'>('train')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadExperiments()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const loadExperiments = async () => {
    try {
      const { data } = await mlApi.experiments()
      setExperiments(data || [])
    } catch { }
  }

  const toggleFeature = (f: string) => {
    setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  const startTraining = async () => {
    if (!region) { toast.error('Select a region in Earth Explorer first'); return }
    if (features.length === 0) { toast.error('Select at least one feature'); return }

    try {
      const { data } = await mlApi.train({
        experiment_name: experimentName,
        model_type: modelType,
        target,
        features,
        region: { min_lat: region.min_lat, max_lat: region.max_lat, min_lon: region.min_lon, max_lon: region.max_lon },
        date_start: dateStart,
        date_end: dateEnd,
        test_split_date: testSplitDate,
        min_pixel_reliability: qualityFilter,
        max_train_rows: maxTrainRows,
      })
      const job: JobResult = { job_id: data.job_id, status: 'pending', progress: 0, name: experimentName }
      setCurrentJob(job)
      toast.success('Training job started')
      startPolling(data.job_id)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to start training')
    }
  }

  const startPolling = (jobId: number) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await mlApi.jobStatus(jobId)
        setCurrentJob(data)
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          if (data.status === 'completed') {
            toast.success('Training complete')
            loadExperiments()
          } else {
            toast.error('Training failed: ' + (data.error || 'Unknown error'))
          }
        }
      } catch { }
    }, 2000)
  }

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle size={16} style={{ color: 'var(--sci-green)' }} />
    if (s === 'failed') return <XCircle size={16} style={{ color: 'var(--coral)' }} />
    if (s === 'running') return <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
    return <Clock size={16} style={{ color: 'var(--amber)' }} />
  }

  return (
    <div className="app-shell">
      <div style={{ marginTop: 'var(--nav-height)' }}>
        {/* Hero */}
        <div className="page-hero ml-hero">
          <div className="page-hero-bg" style={{ backgroundImage: "url('/mlstudio_bg.png')" }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Brain size={26} style={{ color: 'var(--purple)' }} />
              <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: 0 }}>ML Studio</h1>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>
              Train and benchmark predictive vegetation models on historical NASA MODIS observations.
            </p>
            {region ? (
              <div style={{ marginTop: 10 }}>
                <span className="badge badge-cyan" style={{ fontSize: '0.78rem' }}>
                  Target Region: [{region.min_lat}°, {region.max_lat}°] × [{region.min_lon}°, {region.max_lon}°]
                </span>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <span className="badge badge-amber" style={{ fontSize: '0.78rem' }}>
                  Default Global Context Active (Select region in Earth Explorer for custom bounds)
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="page-content" style={{ padding: '24px 40px' }}>
          {/* Navigation */}
          <div className="tab-nav" style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
            <button className={`tab-btn ${activeTab === 'train' ? 'active' : ''}`} onClick={() => setActiveTab('train')}>
              <Brain size={14} /> Configure & Train
            </button>
            <button className={`tab-btn ${activeTab === 'experiments' ? 'active' : ''}`} onClick={() => { setActiveTab('experiments'); loadExperiments() }}>
              <Activity size={14} /> Experiments ({experiments.length})
            </button>
          </div>

          {/* Train tab */}
          {activeTab === 'train' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="grid-2" style={{ gap: 24, marginBottom: 24 }}>
                {/* Config panel */}
                <GlassCard>
                  <div style={{ marginBottom: 20 }}>
                    <div className="section-title" style={{ marginBottom: 16 }}>Model Architecture</div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label">Experiment Identifier</label>
                      <input className="form-input" value={experimentName} onChange={e => setExperimentName(e.target.value)} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label">Target Metric</label>
                      <select className="form-select" value={target} onChange={e => setTarget(e.target.value)}>
                        <option value="NDVI">NDVI — Normalized Difference Vegetation Index</option>
                        <option value="EVI">EVI — Enhanced Vegetation Index</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label">Algorithm Selection</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {MODEL_OPTIONS.map(m => (
                          <label key={m.value} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: `1px solid ${modelType === m.value ? 'var(--purple)' : 'var(--border-subtle)'}`,
                            background: modelType === m.value ? 'var(--purple-dim)' : 'var(--deep-space)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                          }}>
                            <input type="radio" name="model" value={m.value} checked={modelType === m.value}
                              onChange={() => setModelType(m.value)} style={{ marginTop: 3 }} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{m.label}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Features + training config */}
                <GlassCard>
                  <div className="section-title" style={{ marginBottom: 16 }}>Training Features & Split</div>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Selected Features ({features.length})</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {FEATURE_OPTIONS.map(f => (
                        <button
                          key={f}
                          className={`btn btn-sm ${features.includes(f) ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => toggleFeature(f)}
                          style={{ fontSize: '0.78rem' }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Chronological Train/Test Split Date</label>
                    <input className="form-input" type="date" value={testSplitDate}
                      onChange={e => setTestSplitDate(e.target.value)} />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Chronological partitioning eliminates lookahead leakage across historical satellite observations.
                    </p>
                  </div>

                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label">Training Sample Size</label>
                    <select className="form-select" value={maxTrainRows}
                      onChange={e => setMaxTrainRows(Number(e.target.value))}>
                      <option value={20000}>20,000 samples (Fast)</option>
                      <option value={50000}>50,000 samples</option>
                      <option value={100000}>100,000 samples (Recommended)</option>
                      <option value={200000}>200,000 samples (High Precision)</option>
                    </select>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}
                    onClick={startTraining}
                    disabled={currentJob?.status === 'running' || currentJob?.status === 'pending'}
                  >
                    <Play size={16} /> Execute Training
                  </button>
                </GlassCard>
              </div>

              {/* Job progress */}
              {currentJob && (
                <GlassCard style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {statusIcon(currentJob.status)}
                      <div>
                        <div style={{ fontWeight: 600 }}>{currentJob.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          Status: {currentJob.status}
                        </div>
                      </div>
                    </div>
                  </div>

                  {currentJob.status === 'running' && (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.round(currentJob.progress * 100)}%` }} />
                    </div>
                  )}

                  {currentJob.status === 'failed' && (
                    <div style={{ color: 'var(--coral)', fontSize: '0.85rem', marginTop: 8 }}>
                      Error: {currentJob.error}
                    </div>
                  )}

                  {currentJob.status === 'completed' && currentJob.result && (
                    <div style={{ marginTop: 16 }}>
                      <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
                        <div className="stat-card">
                          <div className="stat-card-value" style={{ color: 'var(--sci-green)' }}>
                            {currentJob.result.metrics.r2.toFixed(4)}
                          </div>
                          <div className="stat-card-label">Test R² Score</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-card-value">{currentJob.result.metrics.mae.toFixed(4)}</div>
                          <div className="stat-card-label">Mean Absolute Error</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-card-value">{currentJob.result.metrics.rmse.toFixed(4)}</div>
                          <div className="stat-card-label">Root Mean Squared Error</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Artifact generated: <code style={{ color: 'var(--cyan)' }}>{currentJob.result.artifact_path}</code>. Open the <strong>Predict</strong> tab above to perform inference.
                      </div>
                    </div>
                  )}
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* Experiments tab */}
          {activeTab === 'experiments' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn btn-ghost btn-sm" onClick={loadExperiments}>
                  <RefreshCw size={14} /> Refresh Experiments
                </button>
              </div>
              {experiments.length === 0 ? (
                <GlassCard>
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Brain size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ color: 'var(--text-muted)' }}>No experiments found. Train a model to see evaluation metrics.</p>
                  </div>
                </GlassCard>
              ) : (
                <GlassCard padding="0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Experiment</th>
                        <th>Model</th>
                        <th>Target</th>
                        <th>R²</th>
                        <th>MAE</th>
                        <th>RMSE</th>
                        <th>Train / Test Samples</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {experiments.map((e: any) => (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</td>
                          <td><span className="badge badge-purple">{e.model_type}</span></td>
                          <td><span className="badge badge-cyan">{e.target}</span></td>
                          <td style={{ color: 'var(--sci-green)', fontWeight: 700, fontFamily: 'monospace' }}>{e.r2?.toFixed(4)}</td>
                          <td style={{ fontFamily: 'monospace' }}>{e.mae?.toFixed(4)}</td>
                          <td style={{ fontFamily: 'monospace' }}>{e.rmse?.toFixed(4)}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e.train_samples?.toLocaleString()} / {e.test_samples?.toLocaleString()}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e.created_at?.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        .ml-hero {
          background: var(--deep-space);
          min-height: 180px;
          display: flex;
          align-items: center;
        }
        .page-hero-bg {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          filter: brightness(0.18) saturate(1.2);
          z-index: 0;
        }
        .page-hero { position: relative; overflow: hidden; padding: 40px 40px; border-bottom: 1px solid var(--border-subtle); }
      `}</style>
    </div>
  )
}
