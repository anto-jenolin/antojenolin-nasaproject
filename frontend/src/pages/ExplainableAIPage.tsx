import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap, BarChart2, TrendingUp, GitBranch, Info } from 'lucide-react'
import { xaiApi, mlApi } from '../api/client'
import { useRegion } from '../contexts/RegionContext'
import GlassCard from '../components/shared/GlassCard'
import FeatureImportanceChart from '../components/charts/FeatureImportanceChart'
import toast from 'react-hot-toast'

// Typical MODIS vegetation index values for pre-populating local explanation inputs
const FEATURE_DEFAULTS: Record<string, { value: string; min: string; max: string; hint: string }> = {
  EVI:                  { value: '0.35', min: '0.0',  max: '1.0',  hint: 'Typical: 0.1–0.6 (dense vegetation ~0.5)' },
  NIR_Reflectance:      { value: '0.45', min: '0.0',  max: '1.0',  hint: 'Typical: 0.2–0.6 (high for vegetation)' },
  Red_Reflectance:      { value: '0.08', min: '0.0',  max: '0.5',  hint: 'Typical: 0.02–0.15 (low for vegetation)' },
  Blue_Reflectance:     { value: '0.03', min: '0.0',  max: '0.3',  hint: 'Typical: 0.01–0.05' },
  MIR_Reflectance:      { value: '0.15', min: '0.0',  max: '0.5',  hint: 'Typical: 0.05–0.30' },
  Avg_Sun_Zenith_Angle: { value: '35.0', min: '0.0',  max: '90.0', hint: 'Typical: 20–60° (solar zenith)' },
  NDVI:                 { value: '0.55', min: '-1.0', max: '1.0',  hint: 'Typical: 0.2–0.8 (dense vegetation ~0.6)' },
}

function getFeatureDefault(f: string) {
  const norm = Object.keys(FEATURE_DEFAULTS).find(k => k.toLowerCase() === f.toLowerCase())
  if (norm) return FEATURE_DEFAULTS[norm]
  return { value: '0.35', min: '0.0', max: '1.0', hint: 'Suggested typical value: 0.35' }
}

function buildDefaultLocalFeatures(featureList: string[]): Record<string, string> {
  const defaults: Record<string, string> = {}
  for (const f of featureList) {
    defaults[f] = getFeatureDefault(f).value
  }
  return defaults
}

export default function ExplainableAIPage() {
  const { region, dateStart, dateEnd } = useRegion()
  const [experiments, setExperiments] = useState<any[]>([])
  const [selectedExp, setSelectedExp] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'global' | 'local' | 'pdp'>('global')
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const [globalResult, setGlobalResult] = useState<any>(null)
  const [localResult, setLocalResult] = useState<any>(null)
  const [pdpResult, setPdpResult] = useState<any>(null)
  const [pdpFeature, setPdpFeature] = useState('')
  const [localFeatures, setLocalFeatures] = useState<Record<string, string>>({})
  const [sampleSize, setSampleSize] = useState(200)

  useEffect(() => {
    mlApi.experiments().then(r => {
      const data = r.data || []
      setExperiments(data)
      if (data.length > 0 && !selectedExp) {
        setSelectedExp(data[0])
      }
    }).catch(() => {})
  }, [])

  function parseFeatures(raw: any): string[] {
    if (!raw) return ['EVI', 'NIR_Reflectance', 'Red_Reflectance']
    if (Array.isArray(raw)) return raw
    try { return JSON.parse(raw) } catch { return ['EVI', 'NIR_Reflectance', 'Red_Reflectance'] }
  }

  // When experiment changes: reset results and pre-populate local feature defaults
  useEffect(() => {
    setGlobalResult(null)
    setGlobalError(null)
    setLocalResult(null)
    setPdpResult(null)
    if (selectedExp) {
      const feats = parseFeatures(selectedExp.features)
      setLocalFeatures(buildDefaultLocalFeatures(feats))
      if (!pdpFeature && feats.length > 0) {
        setPdpFeature(feats[0])
      }
    }
  }, [selectedExp])

  const runGlobal = async () => {
    if (!selectedExp) { toast.error('Select an experiment first'); return }
    setLoading(true)
    setGlobalResult(null)
    setGlobalError(null)
    try {
      const body: any = {
        artifact_path: selectedExp.artifact_path,
        sample_size: sampleSize,
      }
      if (region) {
        body.region = { min_lat: region.min_lat, max_lat: region.max_lat, min_lon: region.min_lon, max_lon: region.max_lon }
        body.date_start = dateStart
        body.date_end = dateEnd
      }
      const { data } = await xaiApi.globalExplain(body)
      if (!data || (!data.native_importance && !data.permutation_importance && !data.shap_mean_abs)) {
        setGlobalError('No feature importance data returned from model. Try a different experiment.')
      } else {
        setGlobalResult(data)
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Explanation failed'
      setGlobalError(msg)
      toast.error(msg)
    } finally { setLoading(false) }
  }

  const runPDP = async () => {
    if (!selectedExp || !pdpFeature) { toast.error('Select experiment and feature'); return }
    setLoading(true)
    try {
      const body: any = {
        artifact_path: selectedExp.artifact_path,
        feature: pdpFeature,
      }
      if (region) {
        body.region = { min_lat: region.min_lat, max_lat: region.max_lat, min_lon: region.min_lon, max_lon: region.max_lon }
        body.date_start = dateStart
        body.date_end = dateEnd
      }
      const { data } = await xaiApi.pdp(body)
      setPdpResult(data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'PDP failed')
    } finally { setLoading(false) }
  }

  const runLocal = async () => {
    if (!selectedExp) { toast.error('Select an experiment first'); return }
    setLoading(true)
    try {
      const featureValues: Record<string, number> = {}
      for (const [k, v] of Object.entries(localFeatures)) {
        featureValues[k] = parseFloat(v) || 0
      }
      const { data } = await xaiApi.localExplain({
        artifact_path: selectedExp.artifact_path,
        feature_values: featureValues,
      })
      setLocalResult(data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Local explanation failed')
    } finally { setLoading(false) }
  }

  const features = parseFeatures(selectedExp?.features)

  return (
    <div className="app-shell">
      <div style={{ marginTop: 'var(--nav-height)' }}>
        {/* Hero */}
        <div className="page-hero xai-hero">
          <div className="page-hero-bg" style={{ backgroundImage: "url('/xai_bg.png')" }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Zap size={28} style={{ color: 'var(--amber)' }} />
              <h1 style={{ fontSize: '2rem' }}>Explainable AI</h1>
            </div>
            <p>Understand your trained models — global feature importance, partial dependence plots, and local prediction explanations.</p>
            <div style={{ marginTop: 12 }}>
              <span className="badge badge-amber">
                <Info size={11} /> Feature importance ≠ causation
              </span>
            </div>
          </div>
        </div>

        <div className="page-content">
          {/* Experiment selector */}
          <GlassCard style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 300px' }}>
                <label className="form-label">Select Experiment</label>
                <select className="form-select" value={selectedExp?.id || ''}
                  onChange={e => setSelectedExp(experiments.find(x => x.id === +e.target.value) || null)}>
                  <option value="">— Choose a trained experiment —</option>
                  {experiments.map((exp: any) => (
                    <option key={exp.id} value={exp.id}>
                      {exp.name} · {exp.model_type} · R²={exp.r2?.toFixed(3)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: '0 0 140px' }}>
                <label className="form-label">SHAP Sample Size</label>
                <select className="form-select" value={sampleSize} onChange={e => setSampleSize(+e.target.value)}>
                  <option value={200}>200 (fast)</option>
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={2000}>2,000 (slow)</option>
                </select>
              </div>
              {selectedExp && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="badge badge-cyan">{selectedExp.model_type}</span>
                  <span className="badge badge-green">Target: {selectedExp.target}</span>
                  <span className="badge badge-purple">R²: {selectedExp.r2?.toFixed(4)}</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Tabs */}
          <div className="tab-nav">
            <button className={`tab-btn ${activeTab === 'global' ? 'active' : ''}`} onClick={() => setActiveTab('global')}>
              <BarChart2 size={14} /> Global Feature Importance
            </button>
            <button className={`tab-btn ${activeTab === 'pdp' ? 'active' : ''}`} onClick={() => setActiveTab('pdp')}>
              <TrendingUp size={14} /> Partial Dependence
            </button>
            <button className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`} onClick={() => setActiveTab('local')}>
              <GitBranch size={14} /> Local Explanation
            </button>
          </div>

          {/* Global explanation */}
          {activeTab === 'global' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={runGlobal} disabled={!selectedExp || loading}>
                  {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Zap size={14} />}
                  Compute Feature Importance
                </button>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Uses model-native feature importance (mean impurity decrease for tree models). SHAP values computed where supported.
                </p>
              </div>

              {globalError && (
                <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#f87171', marginBottom: 20, fontSize: '0.85rem' }}>
                  {globalError}
                </div>
              )}

              {globalResult && (
                <div className="grid-2" style={{ gap: 24 }}>
                  {(globalResult.native_importance || globalResult.permutation_importance) && (
                    <GlassCard>
                      <div className="section-title" style={{ marginBottom: 16 }}>Feature Importance</div>
                      <FeatureImportanceChart data={
                        Object.entries(globalResult.native_importance || globalResult.permutation_importance || {})
                          .map(([name, importance]) => ({ name, value: importance as number }))
                          .sort((a, b) => b.value - a.value)
                      } />
                      <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--deep-space)', borderRadius: 8 }}>
                        ⚠ Feature importance shows which inputs influenced model predictions, not which factors cause vegetation change.
                      </div>
                    </GlassCard>
                  )}

                  {globalResult.shap_mean_abs && (
                    <GlassCard>
                      <div className="section-title" style={{ marginBottom: 16 }}>SHAP Mean |Values|</div>
                      <FeatureImportanceChart data={
                        Object.entries(globalResult.shap_mean_abs)
                          .map(([name, importance]) => ({ name, value: importance as number }))
                          .sort((a, b) => b.value - a.value)
                      } />
                    </GlassCard>
                  )}

                  {globalResult.model_info && (
                    <GlassCard>
                      <div className="section-title" style={{ marginBottom: 12 }}>Model Provenance</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(globalResult.model_info).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                </div>
              )}

              {!globalResult && !loading && (
                <GlassCard>
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <BarChart2 size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ color: 'var(--text-muted)' }}>Select an experiment and click "Compute Feature Importance"</p>
                  </div>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* PDP */}
          {activeTab === 'pdp' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GlassCard style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label className="form-label">Feature for PDP</label>
                    <select className="form-select" value={pdpFeature} onChange={e => setPdpFeature(e.target.value)}>
                      <option value="">— Select feature —</option>
                      {(features.length > 0 ? features : ['EVI', 'NIR_Reflectance', 'Red_Reflectance']).map((f: string) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={runPDP} disabled={!selectedExp || !pdpFeature || loading}>
                    {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <TrendingUp size={14} />}
                    Compute PDP
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12 }}>
                  Partial dependence shows the marginal effect of a single feature on the prediction, averaging over all other features.
                </p>
              </GlassCard>

              {pdpResult && pdpResult.grid && (
                <GlassCard>
                  <div className="section-title" style={{ marginBottom: 16 }}>Partial Dependence: {pdpFeature}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ maxWidth: 600 }}>
                      <thead>
                        <tr>
                          <th>{pdpFeature}</th>
                          <th>Mean Predicted {selectedExp?.target || 'NDVI'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdpResult.grid.map((gv: number, i: number) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace' }}>{gv.toFixed(4)}</td>
                            <td style={{ fontFamily: 'monospace', color: 'var(--sci-green)' }}>
                              {pdpResult.pdp?.[i]?.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* Local explanation */}
          {activeTab === 'local' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="grid-2" style={{ gap: 24 }}>
                <GlassCard>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div className="section-title" style={{ marginBottom: 0 }}>Input Feature Values</div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      onClick={() => setLocalFeatures(buildDefaultLocalFeatures(features))}
                    >
                      Fill Suggested Values
                    </button>
                  </div>
                  {(features.length > 0 ? features : ['EVI', 'NIR_Reflectance', 'Red_Reflectance']).map((f: string) => {
                    const info = getFeatureDefault(f)
                    return (
                      <div key={f} className="form-group" style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                          <label className="form-label" style={{ marginBottom: 0 }}>{f}</label>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{info.hint}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="form-input"
                            type="number"
                            step="0.001"
                            value={localFeatures[f] ?? ''}
                            onChange={e => setLocalFeatures(prev => ({ ...prev, [f]: e.target.value }))}
                            placeholder={`e.g. ${info.value}`}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '6px 10px', whiteSpace: 'nowrap' }}
                            onClick={() => setLocalFeatures(prev => ({ ...prev, [f]: info.value }))}
                            title={`Use suggested default ${info.value}`}
                          >
                            Use {info.value}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                    onClick={runLocal} disabled={!selectedExp || loading}>
                    {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <GitBranch size={14} />}
                    Explain This Prediction
                  </button>
                </GlassCard>

                {localResult && (
                  <GlassCard>
                    <div className="section-title" style={{ marginBottom: 16 }}>Local Explanation</div>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--sci-green)', fontFamily: 'Space Grotesk' }}>
                        {localResult.prediction?.toFixed(4)}
                      </div>
                      <div className="stat-card-label">Predicted {selectedExp?.target}</div>
                    </div>
                    {localResult.feature_contributions && (
                      <FeatureImportanceChart data={
                        Object.entries(localResult.feature_contributions)
                          .map(([name, value]) => ({ name, value: Math.abs(value as number) }))
                          .sort((a, b) => b.value - a.value)
                      } />
                    )}
                    <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--deep-space)', borderRadius: 8 }}>
                      Contributions show relative input influence. This is a model explanation, not a physical mechanism.
                    </div>
                  </GlassCard>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        .xai-hero { min-height: 200px; display: flex; align-items: center; }
        .page-hero { position: relative; overflow: hidden; padding: 48px 40px; border-bottom: 1px solid var(--border-subtle); }
        .page-hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: brightness(0.18) saturate(1.2); z-index: 0; }
      `}</style>
    </div>
  )
}
