import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Compass, Globe, Layers, BarChart2,
  Cpu, Activity, FileText, ChevronDown, ChevronRight,
  Search, ShieldCheck, HelpCircle
} from 'lucide-react'
import GlassCard from '../components/shared/GlassCard'

interface DocSection {
  id: string
  title: string
  category: string
  icon: any
  summary: string
  details: {
    overview: string
    keyPoints: string[]
    exampleOrFormula?: string
  }
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    title: '1. Getting Started & System Overview',
    category: 'Architecture',
    icon: Compass,
    summary: 'Platform overview, user accounts, and core navigation capabilities.',
    details: {
      overview: 'TerraPulse AI is an Earth science analytics platform built for students, researchers, and data detectives. It unifies satellite observations from NASA missions (MODIS, OMI, AIRS, GPM) and Earth system models (MERRA-2, GLDAS).',
      keyPoints: [
        'Default Administrator credentials: admin@terrapulse.local / TerraPulse@Admin2024',
        'New accounts can register instantly at /register with secure token authentication.',
        'Runs self-contained on any computer with pre-compiled single-page frontend served by FastAPI.',
      ],
    },
  },
  {
    id: 'earth-explorer',
    title: '2. Earth Change Explorer & Data Detective',
    category: 'Analysis & Exploration',
    icon: Globe,
    summary: 'Select variables, draw bounding boxes, inspect spatial grids, and assess statistical trends.',
    details: {
      overview: 'The Earth Change Explorer allows users to investigate what is changing, where it is changing, how much it is changing, and whether changes are statistically significant.',
      keyPoints: [
        'Variable Selection: Switch between MODIS vegetation indices, surface reflectance, OMI ozone, AIRS atmospheric temperature, GPM precipitation, and GLDAS soil moisture.',
        'Demonstration Presets: 1-click curated scenarios for the Amazon Rainforest, California Drought, Arctic Warming, Sahara Dust, and Ganges Monsoon.',
        'Trendline Overlay: Automatic Ordinary Least Squares (OLS) fitted trendlines displayed directly on monthly time-series curves.',
        'Export Formats: 1-click annotated CSV (<variable>_<start>_to_<end>.csv) with full statistical tables and high-resolution PNG chart image downloads.',
      ],
      exampleOrFormula: 'OLS Rate of Change: y = βx + α | Annualized Slope: β × 12 months/year',
    },
  },
  {
    id: 'significance-testing',
    title: '3. Statistical Significance & Hypothesis Testing',
    category: 'Statistics & Science',
    icon: BarChart2,
    summary: 'Understanding p-values, confidence intervals, t-tests, and the Mann-Kendall test.',
    details: {
      overview: 'Earth observation variables often exhibit heavy seasonal fluctuations. The platform evaluates whether observed changes represent genuine structural trends versus natural seasonal noise.',
      keyPoints: [
        'Two-Sided p-value: Tested against user-configurable thresholds (α = 0.01, 0.05, 0.10). When p < α, the trend is designated as Statistically Significant.',
        '95% Confidence Interval: Provides upper and lower error margins for the rate of change per year using Student’s t-distribution.',
        'Mann-Kendall Monotonic Test: Non-parametric rank-based test evaluating whether a monotonic upward or downward trend exists without assuming Gaussian normality.',
      ],
      exampleOrFormula: '95% CI = slope ± (t_crit × SE) | Null Hypothesis (H₀): No linear trend over time.',
    },
  },
  {
    id: 'nasa-modis-data',
    title: '4. NASA MODIS MOD13C2 Dataset',
    category: 'Satellite Missions',
    icon: Layers,
    summary: '319 monthly global Climate Modeling Grid (CMG) composite files from 2000 to present.',
    details: {
      overview: 'MODIS (Moderate Resolution Imaging Spectroradiometer) aboard NASA’s Terra and Aqua satellites measures Earth’s biosphere and reflectance every 16 days, composited into monthly 0.05° (~5.5 km) global grids.',
      keyPoints: [
        'NDVI: Measures photosynthetic green leaf canopy density (-0.2 to 1.0).',
        'EVI: Enhanced Vegetation Index optimizing sensitivity in high-biomass tropical canopies (e.g. Amazon basin).',
        'Reflectance Bands: Red (absorbed by chlorophyll), NIR (reflected by cell structures), Blue (Rayleigh correction), and MIR (moisture stress and wildfire burn scars).',
        'Quality Flags: Pixel Reliability 0 = Good data, 1 = Marginal, 2 = Snow/Ice, 3 = Cloudy.',
      ],
      exampleOrFormula: 'NDVI = (NIR - Red) / (NIR + Red) | EVI = 2.5 × (NIR - Red) / (NIR + 6×Red - 7.5×Blue + 1)',
    },
  },
  {
    id: 'ml-studio',
    title: '5. Machine Learning Studio & Predictive Modeling',
    category: 'Machine Learning',
    icon: Cpu,
    summary: 'Train spatial regression models (Ridge, Random Forest, HistGradientBoosting) with chronological evaluation.',
    details: {
      overview: 'ML Studio enables predictive modeling of Earth science variables across time and space, comparing machine learning regressors against baseline seasonal persistence.',
      keyPoints: [
        'Chronological Splitting: Eliminates data leakage by evaluating models on future unseen time horizons rather than random shuffling.',
        'Evaluation Metrics: Reports RMSE (Root Mean Squared Error), MAE, and R² score on independent test sets.',
        'Model Persistence: Saved model artifacts (.joblib) for downstream deployment and inference.',
      ],
      exampleOrFormula: 'RMSE = √[ (1/n) Σ (y_true - y_pred)² ]',
    },
  },
  {
    id: 'explainable-ai',
    title: '6. Explainable AI & Feature Attribution',
    category: 'Machine Learning',
    icon: Activity,
    summary: 'Interpret model predictions using SHAP values, global feature importance, and partial dependence.',
    details: {
      overview: 'Explainable AI tools unpack black-box models to ensure scientific credibility, showing which spectral bands and environmental drivers influence predictions most heavily.',
      keyPoints: [
        'Global Importance: Ranks the contribution of each spectral band (Red, NIR, Blue, MIR, Zenith Angle).',
        'Local Explanation: Deconstructs an individual regional prediction into positive and negative push factors.',
        'Scientific Caution: Feature importance measures statistical association, not mechanistic causal proof.',
      ],
    },
  },
  {
    id: 'ai-copilot',
    title: '7. AI Copilot Scientific Assistant',
    category: 'Artificial Intelligence',
    icon: BookOpen,
    summary: 'Scientific knowledge assistant with built-in offline reference mode and optional OpenAI API integration.',
    details: {
      overview: 'The AI Copilot answers questions regarding satellite remote sensing, scientific formulas, data quality flags, and statistical trend methodology.',
      keyPoints: [
        'Offline Science Mode: Built-in knowledge base answers core Earth science questions (NDVI, EVI, MODIS, Significance) without requiring API keys.',
        'Online Generative Mode: When OPENAI_API_KEY is configured in backend/.env, enables dynamic conversation with real-time regional context.',
      ],
    },
  },
  {
    id: 'data-lab',
    title: '8. Data Lab & Preprocessing Pipeline',
    category: 'Data Engineering',
    icon: FileText,
    summary: 'Catalog exploration, schema inspection, missing-value interpolation, and QA filtering.',
    details: {
      overview: 'Data Lab provides transparent dataset auditing across all 319 Parquet files, allowing users to inspect missing data rates and export curated subsets.',
      keyPoints: [
        'Schema Browser: Inspect physical data types, column descriptions, and scale factors.',
        'Quality Summary: Audits valid pixel percentages and cloud obstruction frequencies per region.',
        'Export Capabilities: Export filtered subsets directly for external GIS tools (QGIS, ArcGIS).',
      ],
    },
  },
]

export default function DocumentationPage() {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>('getting-started')
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const categories = ['All', 'Architecture', 'Analysis & Exploration', 'Statistics & Science', 'Satellite Missions', 'Machine Learning', 'Artificial Intelligence', 'Data Engineering']

  const filtered = DOC_SECTIONS.filter(sec => {
    const matchesSearch =
      sec.title.toLowerCase().includes(search.toLowerCase()) ||
      sec.summary.toLowerCase().includes(search.toLowerCase()) ||
      sec.details.overview.toLowerCase().includes(search.toLowerCase()) ||
      sec.details.keyPoints.some(p => p.toLowerCase().includes(search.toLowerCase()))

    const matchesCategory = activeCategory === 'All' || sec.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="app-shell">
      <div style={{ marginTop: 'var(--nav-height)', padding: '28px 24px', maxWidth: 1100, marginInline: 'auto' }}>
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BookOpen size={28} style={{ color: 'var(--cyan)' }} />
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>TerraPulse AI Documentation</h1>
              </div>
              <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Complete reference manual for Earth Change Explorer, NASA multi-mission satellite data, statistical significance testing, and machine learning workflows.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(54, 214, 231, 0.08)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(54, 214, 231, 0.25)' }}>
              <ShieldCheck size={16} style={{ color: 'var(--cyan)' }} />
              <span style={{ fontSize: '0.76rem', color: 'var(--cyan)', fontWeight: 600 }}>NASA Challenge Reference</span>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search concepts, variables, formulas, or statistical tests (e.g. NDVI, Mann-Kendall, OLS, MODIS)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 42, width: '100%', fontSize: '0.88rem', background: 'rgba(255, 255, 255, 0.03)' }}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sections list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(sec => {
              const Icon = sec.icon
              const isExpanded = expandedId === sec.id

              return (
                <div
                  key={sec.id}
                  style={{
                    background: isExpanded ? 'rgba(54, 214, 231, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isExpanded ? 'rgba(54, 214, 231, 0.35)' : 'var(--border-subtle)'}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Header row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : sec.id)}
                    style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: 'rgba(54, 214, 231, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--cyan)'
                      }}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.98rem', color: isExpanded ? 'var(--cyan)' : 'var(--text-primary)' }}>
                            {sec.title}
                          </span>
                          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)' }}>
                            {sec.category}
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {sec.summary}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={18} style={{ color: 'var(--cyan)' }} /> : <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />}
                  </div>

                  {/* Expanded body */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ padding: '0 18px 18px 64px' }}
                      >
                        <p style={{ fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 12 }}>
                          {sec.details.overview}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                          {sec.details.keyPoints.map((point, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.8rem', lineHeight: 1.5 }}>
                              <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>•</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{point}</span>
                            </div>
                          ))}
                        </div>

                        {sec.details.exampleOrFormula && (
                          <div style={{
                            padding: '10px 14px',
                            background: 'rgba(0, 0, 0, 0.35)',
                            borderRadius: 6,
                            borderLeft: '3px solid var(--cyan)',
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            color: '#e2e8f0',
                          }}>
                            {sec.details.exampleOrFormula}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                <HelpCircle size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p>No documentation found matching "{search}".</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
