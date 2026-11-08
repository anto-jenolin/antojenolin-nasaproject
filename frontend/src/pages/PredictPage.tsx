import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, RefreshCw, Sparkles,
  Leaf, Info, Sprout, AlertTriangle, ShieldCheck
} from 'lucide-react'
import { mlApi } from '../api/client'
import { useRegion } from '../contexts/RegionContext'
import GlassCard from '../components/shared/GlassCard'
import FeatureImportanceChart from '../components/charts/FeatureImportanceChart'
import toast from 'react-hot-toast'

const FEATURE_OPTIONS = [
  'EVI', 'Red_Reflectance', 'NIR_Reflectance', 'Blue_Reflectance',
  'MIR_Reflectance', 'Avg_Sun_Zenith_Angle', 'NDVI_StdDev', 'EVI_StdDev',
]

// Preset samples for single prediction
const PRESETS = [
  {
    name: 'Dense Canopy (Rainforest / Cropland)',
    badge: 'Dense Canopy',
    color: 'var(--sci-green)',
    values: {
      EVI: '0.485',
      Red_Reflectance: '0.038',
      NIR_Reflectance: '0.442',
      Blue_Reflectance: '0.021',
      MIR_Reflectance: '0.115',
      Avg_Sun_Zenith_Angle: '31.4',
    },
  },
  {
    name: 'Moderate Vegetation (Grassland / Parkland)',
    badge: 'Moderate',
    color: 'var(--cyan)',
    values: {
      EVI: '0.310',
      Red_Reflectance: '0.082',
      NIR_Reflectance: '0.320',
      Blue_Reflectance: '0.045',
      MIR_Reflectance: '0.178',
      Avg_Sun_Zenith_Angle: '36.8',
    },
  },
  {
    name: 'Sparse Ground (Arid Shrubland / Soil)',
    badge: 'Sparse / Arid',
    color: 'var(--amber)',
    values: {
      EVI: '0.135',
      Red_Reflectance: '0.210',
      NIR_Reflectance: '0.245',
      Blue_Reflectance: '0.112',
      MIR_Reflectance: '0.285',
      Avg_Sun_Zenith_Angle: '44.2',
    },
  },
]

/**
 * Returns plain-language ecological guidance and planting recommendations based on predicted NDVI.
 */
function getEcologicalInterpretation(ndvi: number) {
  if (ndvi >= 0.60) {
    return {
      status: 'Dense, Photosynthetically Active Canopy',
      statusColor: 'var(--sci-green)',
      badge: 'Thriving Vegetation',
      icon: ShieldCheck,
      reason:
        'Near-Infrared (NIR) reflectance is elevated while Red light is strongly absorbed by chlorophyll. This indicates optimal leaf area index (LAI), high cellular moisture, and vigorous photosynthesis.',
      recommendation:
        'Excellent conditions for dense crops (maize, soybeans, rice, orchards) or canopy restoration with native hardwood trees (oak, mahogany, teak). Soil moisture and nutrients are well preserved.',
    }
  } else if (ndvi >= 0.35) {
    return {
      status: 'Moderate Vegetation / Transition Zone',
      statusColor: 'var(--cyan)',
      badge: 'Moderate Health',
      icon: Sprout,
      reason:
        'Moderate chlorophyll absorption with balanced reflectance across NIR and Mid-Infrared bands. Typical of open woodlands, pastures, perennial grasslands, or early vegetative growth stages.',
      recommendation:
        'Ideal for mixed agroforestry, cover crops (clover, alfalfa), and cereal grains. Planting leguminous crops will enrich soil nitrogen and accelerate canopy closure.',
    }
  } else if (ndvi >= 0.15) {
    return {
      status: 'Sparse Shrubland / Low Foliage Cover',
      statusColor: 'var(--amber)',
      badge: 'Moisture / Canopy Stress',
      icon: AlertTriangle,
      reason:
        'Red surface reflectance is elevated due to exposed topsoil and dry surface biomass. Photosynthetic activity is constrained by moisture deficits or high thermal stress.',
      recommendation:
        'Plant drought-resilient species (millet, sorghum, acacia, agave, or drought-tolerant grasses). Introduce drip irrigation, mulch retention, and windbreaks to build up organic soil matter.',
    }
  } else {
    return {
      status: 'Barren Soil, Rock, or Severe Degradation',
      statusColor: 'var(--coral)',
      badge: 'Critical Land Stress',
      icon: AlertTriangle,
      reason:
        'Spectral signature shows minimal difference between Red and NIR bands, consistent with dry bare ground, rocky terrain, sand, or post-disturbance burn scars.',
      recommendation:
        'Prioritize soil remediation before intensive agriculture: establish deep-rooted pioneer grasses, contour bunds, water-harvesting swales, and compost addition to arrest erosion.',
    }
  }
}

export default function PredictPage() {
  const { region } = useRegion()

  const [artifactsList, setArtifactsList] = useState<any[]>([])
  const [experiments, setExperiments] = useState<any[]>([])
  const [selectedArtifact, setSelectedArtifact] = useState('')
  const [predicting, setPredicting] = useState(false)
  const [predResult, setPredResult] = useState<any>(null)
  const [predFeatures, setPredFeatures] = useState<Record<string, string>>({
    EVI: '0.450',
    Red_Reflectance: '0.045',
    NIR_Reflectance: '0.410',
    Blue_Reflectance: '0.025',
    MIR_Reflectance: '0.120',
    Avg_Sun_Zenith_Angle: '32.0',
  })

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const [artRes, expRes] = await Promise.allSettled([
        mlApi.artifacts(),
        mlApi.experiments(),
      ])

      const arts = artRes.status === 'fulfilled' ? (artRes.value.data?.artifacts || []) : []
      const exps = expRes.status === 'fulfilled' ? (expRes.value.data || []) : []

      setArtifactsList(arts)
      setExperiments(exps)

      if (arts.length > 0 && !selectedArtifact) {
        setSelectedArtifact(arts[0].path)
      } else if (exps.length > 0 && !selectedArtifact) {
        setSelectedArtifact(exps[0].artifact_path || '')
      }
    } catch { }
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setPredFeatures(preset.values)
    toast.success(`Loaded preset: ${preset.name}`)
  }

  const runPredict = async () => {
    if (!selectedArtifact) {
      toast.error('Please select a trained model artifact')
      return
    }
    setPredicting(true)
    try {
      const featureValues: Record<string, number> = {}
      for (const [k, v] of Object.entries(predFeatures)) {
        featureValues[k] = parseFloat(v) || 0
      }
      const { data } = await mlApi.predict({
        artifact_path: selectedArtifact,
        feature_values: featureValues,
      })
      setPredResult(data)
      toast.success('Prediction generated')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Prediction failed')
    } finally {
      setPredicting(false)
    }
  }

  const ecoInterpretation = predResult ? getEcologicalInterpretation(predResult.prediction) : null

  return (
    <div className="app-shell">
      <div style={{ marginTop: 'var(--nav-height)' }}>
        {/* Hero */}
        <div className="page-hero predict-hero">
          <div className="page-hero-bg" style={{ backgroundImage: "url('/mlstudio_bg.png')" }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <TrendingUp size={26} style={{ color: 'var(--cyan)' }} />
              <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: 0 }}>Vegetation Prediction & Advisory</h1>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>
              Perform real-time vegetation index inference, view spectral explanations, and receive actionable crop planting guidance.
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
                  Global Reference Model Context
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="page-content" style={{ padding: '24px 40px' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
              {/* Left Column: Form & Presets */}
              <GlassCard>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div className="section-title" style={{ margin: 0 }}>Inference Inputs</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={loadModels}
                    style={{ fontSize: '0.75rem', gap: 4 }}
                  >
                    <RefreshCw size={12} /> Reload Models
                  </button>
                </div>

                {/* Artifact Selector Dropdown */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Trained Model Artifact</label>
                  {artifactsList.length > 0 || experiments.length > 0 ? (
                    <select
                      className="form-select"
                      value={selectedArtifact}
                      onChange={e => setSelectedArtifact(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                    >
                      <option value="">-- Choose a trained model artifact --</option>
                      {artifactsList.map(a => (
                        <option key={a.path} value={a.path}>
                          {a.filename} ({a.model_type} · R²: {a.metrics?.r2 ? a.metrics.r2.toFixed(3) : 'N/A'})
                        </option>
                      ))}
                      {experiments.map(exp => (
                        exp.artifact_path && !artifactsList.some(a => a.path === exp.artifact_path) && (
                          <option key={exp.id} value={exp.artifact_path}>
                            {exp.name} ({exp.model_type} · R²: {exp.r2 ? exp.r2.toFixed(3) : 'N/A'})
                          </option>
                        )
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-input"
                      value={selectedArtifact}
                      onChange={e => setSelectedArtifact(e.target.value)}
                      placeholder="Select an experiment or load an artifact"
                    />
                  )}
                </div>

                {/* Quick Preset Samples */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
                    Sample Reflectance Presets:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PRESETS.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => applyPreset(p)}
                        style={{
                          border: '1px solid var(--border-blue)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          fontSize: '0.76rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Sparkles size={12} style={{ color: p.color }} />
                        {p.badge}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feature inputs with defaults */}
                {FEATURE_OPTIONS.slice(0, 6).map(f => (
                  <div key={f} className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {f.replace(/_/g, ' ')}
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.001"
                      value={predFeatures[f] ?? ''}
                      onChange={e => setPredFeatures(prev => ({ ...prev, [f]: e.target.value }))}
                      placeholder="Enter value"
                    />
                  </div>
                ))}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: '12px 20px' }}
                  onClick={runPredict}
                  disabled={predicting || !selectedArtifact}
                >
                  {predicting ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <TrendingUp size={16} />}
                  {predicting ? 'Computing…' : 'Generate Prediction & Advisory'}
                </button>
              </GlassCard>

              {/* Right Column: Prediction + Plant Guidance + Scientific Reason */}
              <div>
                {predResult && ecoInterpretation ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Metric Banner */}
                    <GlassCard>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span className="section-title" style={{ margin: 0 }}>Predicted Vegetation Index</span>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: ecoInterpretation.statusColor }}>
                          {ecoInterpretation.badge}
                        </span>
                      </div>

                      <div style={{ textAlign: 'center', padding: '20px 0', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12 }}>
                        <div style={{ fontSize: '3.4rem', fontWeight: 900, color: ecoInterpretation.statusColor, fontFamily: 'Space Grotesk' }}>
                          {predResult.prediction?.toFixed(4)}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                          {ecoInterpretation.status}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Target Metric: {predResult.target || 'NDVI'} · Model Architecture: {predResult.model_type}
                        </div>
                      </div>

                      {/* Practical Planting Recommendation */}
                      <div style={{
                        marginTop: 18,
                        padding: 14,
                        background: 'rgba(54, 214, 231, 0.07)',
                        border: '1px solid rgba(54, 214, 231, 0.25)',
                        borderRadius: 10
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cyan)', fontWeight: 600, fontSize: '0.88rem', marginBottom: 6 }}>
                          <Sprout size={16} />
                          <span>Actionable Planting & Land Management:</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                          {ecoInterpretation.recommendation}
                        </p>
                      </div>

                      {/* Plain Language Scientific Reason */}
                      <div style={{
                        marginTop: 12,
                        padding: 14,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 10
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber)', fontWeight: 600, fontSize: '0.88rem', marginBottom: 6 }}>
                          <Info size={16} />
                          <span>Why is this result observed?</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                          {ecoInterpretation.reason}
                        </p>
                      </div>
                    </GlassCard>

                    {/* Feature Contributions Chart */}
                    {predResult.feature_contributions && (
                      <GlassCard>
                        <div className="section-title" style={{ marginBottom: 12, fontSize: '0.9rem' }}>Feature Relative Influence</div>
                        <FeatureImportanceChart data={
                          Object.entries(predResult.feature_contributions).map(([name, value]) => ({ name, value: value as number }))
                        } />
                      </GlassCard>
                    )}
                  </div>
                ) : (
                  <GlassCard>
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <Leaf size={44} style={{ opacity: 0.25, color: 'var(--cyan)', marginBottom: 14 }} />
                      <h4 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>Ready for Inference</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 340, margin: '0 auto', lineHeight: 1.5 }}>
                        Choose a preset or adjust the spectral reflectance bands, then click <strong>Generate Prediction & Advisory</strong> to view predicted index values, clear scientific explanations, and actionable planting guidance.
                      </p>
                    </div>
                  </GlassCard>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        .predict-hero {
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
