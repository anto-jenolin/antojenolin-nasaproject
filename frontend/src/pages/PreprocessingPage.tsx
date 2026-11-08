import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Play, Eye, CheckCircle, ChevronRight, RefreshCw } from 'lucide-react'
import { preprocessingApi } from '../api/client'
import { useRegion } from '../contexts/RegionContext'
import GlassCard from '../components/shared/GlassCard'
import StatusBadge from '../components/shared/StatusBadge'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 1, label: 'Select Region & Data', desc: 'Define region, date range, variables, and quality filter' },
  { id: 2, label: 'Missing Values', desc: 'Handle NaN values in numeric columns' },
  { id: 3, label: 'Outlier Removal', desc: 'Remove statistical outliers using IQR method' },
  { id: 4, label: 'Normalisation', desc: 'Optionally scale features to a standard range' },
  { id: 5, label: 'Feature Engineering', desc: 'Add temporal and lag features' },
  { id: 6, label: 'Preview & Run', desc: 'Review transformation and submit job' },
]

const VARIABLES = ['NDVI', 'EVI', 'Red_Reflectance', 'NIR_Reflectance', 'Blue_Reflectance', 'MIR_Reflectance', 'Avg_Sun_Zenith_Angle']

export default function PreprocessingPage() {
  const { region, dateStart, dateEnd, setDateRange } = useRegion()
  const [currentStep, setCurrentStep] = useState(1)
  const [jobs, setJobs] = useState<any[]>([])
  const [preview, setPreview] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [options, setOptions] = useState<any>(null)

  // Config
  const [variables, setVariables] = useState(['NDVI', 'EVI'])
  const [maxReliability, setMaxReliability] = useState(1)
  const [missingStrategy, setMissingStrategy] = useState('drop')
  const [removeOutliers, setRemoveOutliers] = useState(true)
  const [iqrFactor, setIqrFactor] = useState(3.0)
  const [normalization, setNormalization] = useState('none')
  const [addMonth, setAddMonth] = useState(true)
  const [addSeason, setAddSeason] = useState(true)
  const [addLag1, setAddLag1] = useState(false)
  const [jobName, setJobName] = useState('preprocessing_job')
  const [maxRows, setMaxRows] = useState(500000)

  const [minLat, setMinLat] = useState(String(region?.min_lat ?? -10))
  const [maxLat, setMaxLat] = useState(String(region?.max_lat ?? 10))
  const [minLon, setMinLon] = useState(String(region?.min_lon ?? -10))
  const [maxLon, setMaxLon] = useState(String(region?.max_lon ?? 10))

  useEffect(() => {
    preprocessingApi.options().then(r => setOptions(r.data)).catch(() => {})
    preprocessingApi.jobs().then(r => setJobs(r.data || [])).catch(() => {})
  }, [])

  const toggleVar = (v: string) => {
    setVariables(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  const buildConfig = () => ({
    min_lat: +minLat, max_lat: +maxLat, min_lon: +minLon, max_lon: +maxLon,
    date_start: dateStart, date_end: dateEnd, variables,
    max_pixel_reliability: maxReliability, missing_strategy: missingStrategy,
    remove_outliers: removeOutliers, outlier_iqr_factor: iqrFactor,
    normalization, add_month: addMonth, add_season: addSeason, add_lag1: addLag1,
    max_rows: maxRows, job_name: jobName,
  })

  const runPreview = async () => {
    setLoadingPreview(true)
    try {
      const { data } = await preprocessingApi.preview({ ...buildConfig(), limit: 500 })
      setPreview(data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Preview failed')
    } finally { setLoadingPreview(false) }
  }

  const submitJob = async () => {
    setSubmitting(true)
    try {
      await preprocessingApi.run(buildConfig())
      toast.success('Preprocessing job started!')
      const { data } = await preprocessingApi.jobs()
      setJobs(data || [])
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to start job')
    } finally { setSubmitting(false) }
  }

  const refreshJobs = async () => {
    const { data } = await preprocessingApi.jobs()
    setJobs(data || [])
  }

  return (
    <div className="app-shell">
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Layers size={28} style={{ color: 'var(--amber)' }} />
          <div>
            <h1 style={{ fontSize: '2rem' }}>Preprocessing</h1>
            <p style={{ marginTop: 4 }}>Configure and run data preprocessing pipeline on bounded region samples.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
          {/* Step nav */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {STEPS.map(s => (
                <button
                  key={s.id}
                  className={`step-btn ${currentStep === s.id ? 'active' : ''} ${currentStep > s.id ? 'done' : ''}`}
                  onClick={() => setCurrentStep(s.id)}
                >
                  <div className="step-indicator">
                    {currentStep > s.id ? <CheckCircle size={14} /> : s.id}
                  </div>
                  <div>
                    <div className="step-label">{s.label}</div>
                    <div className="step-desc">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {currentStep === 1 && (
                  <GlassCard>
                    <h3 style={{ marginBottom: 20 }}>Region & Data Selection</h3>
                    <div className="grid-2" style={{ marginBottom: 16 }}>
                      <div className="form-group">
                        <label className="form-label">Min Latitude</label>
                        <input className="form-input" type="number" value={minLat} onChange={e => setMinLat(e.target.value)} step="0.1" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Max Latitude</label>
                        <input className="form-input" type="number" value={maxLat} onChange={e => setMaxLat(e.target.value)} step="0.1" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Min Longitude</label>
                        <input className="form-input" type="number" value={minLon} onChange={e => setMinLon(e.target.value)} step="0.1" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Max Longitude</label>
                        <input className="form-input" type="number" value={maxLon} onChange={e => setMaxLon(e.target.value)} step="0.1" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date Start</label>
                        <input type="date" className="form-input" value={dateStart} onChange={e => setDateRange(e.target.value, dateEnd)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date End</label>
                        <input type="date" className="form-input" value={dateEnd} onChange={e => setDateRange(dateStart, e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label">Variables to Include</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {VARIABLES.map(v => (
                          <button
                            key={v}
                            className={`btn btn-sm ${variables.includes(v) ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => toggleVar(v)}
                          >{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Pixel Reliability (0=Good only, 1=+Marginal)</label>
                      <select className="form-select" value={maxReliability} onChange={e => setMaxReliability(+e.target.value)}>
                        <option value={0}>0 — Good data only</option>
                        <option value={1}>1 — Good + Marginal</option>
                        <option value={3}>3 — Include all</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginTop: 16 }}>
                      <label className="form-label">Max Rows</label>
                      <input type="number" className="form-input" value={maxRows} min={1000} max={2000000} step={10000}
                        onChange={e => setMaxRows(+e.target.value)} />
                    </div>
                  </GlassCard>
                )}

                {currentStep === 2 && (
                  <GlassCard>
                    <h3 style={{ marginBottom: 20 }}>Missing Value Strategy</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {options?.missing_strategies && Object.entries(options.missing_strategies).map(([key, desc]: any) => (
                        <label key={key} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                          padding: 14, borderRadius: 10,
                          background: missingStrategy === key ? 'var(--cyan-dim)' : 'var(--panel-blue)',
                          border: `1px solid ${missingStrategy === key ? 'rgba(54,214,231,0.4)' : 'var(--border-subtle)'}`,
                          transition: 'all var(--transition-fast)',
                        }}>
                          <input type="radio" name="missing" value={key} checked={missingStrategy === key}
                            onChange={() => setMissingStrategy(key)} style={{ marginTop: 3 }} />
                          <div>
                            <div style={{ fontWeight: 600, color: missingStrategy === key ? 'var(--cyan)' : 'var(--text-primary)' }}>{key}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {currentStep === 3 && (
                  <GlassCard>
                    <h3 style={{ marginBottom: 20 }}>Outlier Removal</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
                      <input type="checkbox" checked={removeOutliers} onChange={e => setRemoveOutliers(e.target.checked)} />
                      <div>
                        <div style={{ fontWeight: 600 }}>Enable IQR-based outlier removal</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Removes rows where any numeric variable falls beyond factor × IQR from Q1/Q3
                        </div>
                      </div>
                    </label>
                    {removeOutliers && (
                      <div className="form-group">
                        <label className="form-label">IQR Factor (default: 3.0 — conservative)</label>
                        <input type="range" min={1.5} max={5} step={0.5} value={iqrFactor}
                          onChange={e => setIqrFactor(+e.target.value)}
                          style={{ width: '100%', accentColor: 'var(--cyan)' }} />
                        <div style={{ textAlign: 'center', color: 'var(--cyan)', fontWeight: 700 }}>{iqrFactor}×</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Lower = more aggressive outlier removal. 1.5 = standard "mild outlier" rule.
                        </div>
                      </div>
                    )}
                  </GlassCard>
                )}

                {currentStep === 4 && (
                  <GlassCard>
                    <h3 style={{ marginBottom: 20 }}>Normalisation</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {options?.normalization_methods && Object.entries(options.normalization_methods).map(([key, desc]: any) => (
                        <label key={key} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                          padding: 14, borderRadius: 10,
                          background: normalization === key ? 'var(--purple-dim)' : 'var(--panel-blue)',
                          border: `1px solid ${normalization === key ? 'rgba(167,139,250,0.4)' : 'var(--border-subtle)'}`,
                          transition: 'all var(--transition-fast)',
                        }}>
                          <input type="radio" name="norm" value={key} checked={normalization === key}
                            onChange={() => setNormalization(key)} style={{ marginTop: 3 }} />
                          <div>
                            <div style={{ fontWeight: 600, color: normalization === key ? 'var(--purple)' : 'var(--text-primary)' }}>{key}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {currentStep === 5 && (
                  <GlassCard>
                    <h3 style={{ marginBottom: 20 }}>Feature Engineering</h3>
                    {[
                      { label: 'Add Month column', desc: 'Integer month (1–12) derived from Date', val: addMonth, set: setAddMonth },
                      { label: 'Add Season column', desc: 'Season code (0=DJF, 1=MAM, 2=JJA, 3=SON)', val: addSeason, set: setAddSeason },
                      { label: 'Add Lag-1 features', desc: 'Previous-month value for each numeric variable', val: addLag1, set: setAddLag1 },
                    ].map(({ label, desc, val, set }) => (
                      <label key={label} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                        padding: 14, borderRadius: 10, marginBottom: 10,
                        background: val ? 'var(--sci-green-dim)' : 'var(--panel-blue)',
                        border: `1px solid ${val ? 'rgba(124,231,165,0.3)' : 'var(--border-subtle)'}`,
                        transition: 'all var(--transition-fast)',
                      }}>
                        <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ marginTop: 3 }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{label}</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{desc}</div>
                        </div>
                      </label>
                    ))}
                  </GlassCard>
                )}

                {currentStep === 6 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <GlassCard>
                      <h3 style={{ marginBottom: 16 }}>Job Settings</h3>
                      <div className="form-group">
                        <label className="form-label">Job Name</label>
                        <input className="form-input" value={jobName} onChange={e => setJobName(e.target.value)} />
                      </div>
                      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                        <button className="btn btn-secondary" onClick={runPreview} disabled={loadingPreview}>
                          {loadingPreview ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Eye size={14} />}
                          {loadingPreview ? 'Previewing…' : 'Preview Effect'}
                        </button>
                        <button className="btn btn-primary" onClick={submitJob} disabled={submitting}>
                          {submitting ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Play size={14} />}
                          {submitting ? 'Starting…' : 'Run Preprocessing Job'}
                        </button>
                      </div>
                    </GlassCard>

                    {preview && (
                      <GlassCard>
                        <h4 style={{ marginBottom: 16 }}>Preview Results</h4>
                        <div className="grid-3" style={{ marginBottom: 16 }}>
                          <div className="stat-card">
                            <div className="stat-card-label">Rows Before</div>
                            <div className="stat-card-value">{preview.before?.rows?.toLocaleString()}</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-card-label">Rows After</div>
                            <div className="stat-card-value" style={{ color: 'var(--sci-green)' }}>{preview.after?.rows?.toLocaleString()}</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-card-label">Rows Removed</div>
                            <div className="stat-card-value" style={{ color: 'var(--coral)' }}>{preview.rows_removed?.toLocaleString()}</div>
                          </div>
                        </div>
                      </GlassCard>
                    )}
                  </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                  <button className="btn btn-ghost" onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1}>
                    ← Back
                  </button>
                  {currentStep < STEPS.length && (
                    <button className="btn btn-primary" onClick={() => setCurrentStep(currentStep + 1)}>
                      Next <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Jobs list */}
        {jobs.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div className="section-header">
              <h3 className="section-title">Preprocessing Jobs</h3>
              <button className="btn btn-ghost btn-sm" onClick={refreshJobs}><RefreshCw size={13} /> Refresh</button>
            </div>
            <GlassCard padding="0">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Status</th><th>Progress</th><th>Created</th></tr></thead>
                <tbody>
                  {jobs.map((j: any) => (
                    <tr key={j.id}>
                      <td style={{ fontWeight: 600 }}>{j.name}</td>
                      <td><StatusBadge status={j.status} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 120 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: `${(j.progress || 0) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{Math.round((j.progress || 0) * 100)}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{j.created_at?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          </div>
        )}
      </div>

      <style>{`
        .step-btn {
          display: flex; align-items: flex-start; gap: 12;
          width: 100%; padding: 12px 14px;
          border-radius: 10px; border: 1px solid var(--border-subtle);
          background: transparent; cursor: pointer;
          text-align: left; transition: all var(--transition-fast);
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        .step-btn:hover { background: var(--panel-blue); color: var(--text-primary); }
        .step-btn.active { background: var(--amber-dim); border-color: rgba(255,203,116,0.4); color: var(--amber); }
        .step-btn.done { color: var(--sci-green); border-color: rgba(124,231,165,0.2); }
        .step-indicator {
          width: 24px; height: 24px; border-radius: 50%;
          background: var(--panel-blue); border: 1px solid var(--border-blue);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
          margin-top: 2px;
        }
        .step-btn.active .step-indicator { background: var(--amber-dim); border-color: var(--amber); color: var(--amber); }
        .step-btn.done .step-indicator { background: var(--sci-green-dim); border-color: var(--sci-green); color: var(--sci-green); }
        .step-label { font-size: 0.85rem; font-weight: 600; }
        .step-desc { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
      `}</style>
    </div>
  )
}
