import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Crosshair, Trash2, Save, SlidersHorizontal, Globe,
  RefreshCw, Download, Image as ImageIcon, Sparkles,
  TrendingUp, Layers, Compass
} from 'lucide-react'
import { useRegion } from '../contexts/RegionContext'
import { explorerApi } from '../api/client'
import TimeSeriesChart from '../components/charts/TimeSeriesChart'
import type { TimeSeriesDataPoint } from '../components/charts/TimeSeriesChart'
import toast from 'react-hot-toast'

interface VariableItem {
  id: string
  name: string
  mission: string
  category: string
  units: string
  description: string
  simple_definition: string
  is_local: boolean
}

interface GridPoint {
  lat: number
  lon: number
  value: number
  count: number
}

const DEMO_PRESETS = [
  {
    name: 'Amazon Rainforest (Vegetation Trend)',
    variable: 'NDVI',
    bounds: { min_lat: -10, max_lat: 0, min_lon: -70, max_lon: -55 },
    description: 'Investigate tropical forest canopy dynamics, deforestation, and seasonal resilience.',
    source: 'local',
  },
  {
    name: 'California Central Valley (Agricultural Moisture)',
    variable: 'GLDAS_SoilMois',
    bounds: { min_lat: 34, max_lat: 39, min_lon: -121, max_lon: -118 },
    description: 'Analyze multi-year drought, groundwater depletion, and soil moisture shifts.',
    source: 'external',
  },
  {
    name: 'Arctic Warming & High-Latitude Temp',
    variable: 'AIRS_AirTemp',
    bounds: { min_lat: 68, max_lat: 80, min_lon: -50, max_lon: 10 },
    description: 'Measure polar amplification and rapid decadal surface air warming trends.',
    source: 'external',
  },
  {
    name: 'Sahara Desert Dust & Optical Depth',
    variable: 'MERRA2_AOD',
    bounds: { min_lat: 18, max_lat: 28, min_lon: -10, max_lon: 30 },
    description: 'Track atmospheric aerosol optical depth and trans-continental dust storms.',
    source: 'external',
  },
  {
    name: 'Antarctic Ozone Shield',
    variable: 'OMI_O3',
    bounds: { min_lat: -85, max_lat: -65, min_lon: -60, max_lon: 60 },
    description: 'Examine stratospheric ozone thickness and seasonal Antarctic hole recovery.',
    source: 'external',
  },
  {
    name: 'Ganges River Basin (Monsoon Rainfall)',
    variable: 'GPM_Precipitation',
    bounds: { min_lat: 22, max_lat: 30, min_lon: 75, max_lon: 88 },
    description: 'Quantify hydrological precipitation cycles and extreme wet/dry seasons.',
    source: 'external',
  },
]

const GRID_RESOLUTIONS = [
  { label: '0.5°', value: 0.5 },
  { label: '1°', value: 1 },
  { label: '2°', value: 2 },
  { label: '5°', value: 5 },
]

function valueToColor(v: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (v - min) / (max - min || 1)))
  if (t < 0.5) {
    const r = Math.round(255 * (1 - t * 2))
    const g = Math.round(180 * t * 2)
    return `rgba(${r}, ${g}, 0, 0.75)`
  }
  const g = Math.round(180 + 75 * (t - 0.5) * 2)
  const r = Math.round(255 * (1 - (t - 0.5) * 2))
  return `rgba(${r}, ${g}, 0, 0.8)`
}

export default function EarthExplorerPage() {
  const {
    region, setRegion, dateStart, dateEnd, setDateRange,
    variable, setVariable, qualityFilter, setQualityFilter,
    savedRegions, setSavedRegions
  } = useRegion()

  const [availableVars, setAvailableVars] = useState<VariableItem[]>([])
  const [dataSource, setDataSource] = useState<'local' | 'external'>('local')
  const [gridData, setGridData] = useState<GridPoint[]>([])
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [tsLoading, setTsLoading] = useState(false)
  const [resolution, setResolution] = useState(2)
  const [regionName, setRegionName] = useState('')
  const [showControls, setShowControls] = useState(true)
  const [savingRegion, setSavingRegion] = useState(false)
  const [significanceAlpha, setSignificanceAlpha] = useState(0.05)
  const [useMannKendall, setUseMannKendall] = useState(true)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [showDetectiveModal, setShowDetectiveModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  // Manual bounding box inputs
  const [manualLat1, setManualLat1] = useState(region ? String(region.min_lat) : '-10')
  const [manualLat2, setManualLat2] = useState(region ? String(region.max_lat) : '10')
  const [manualLon1, setManualLon1] = useState(region ? String(region.min_lon) : '-10')
  const [manualLon2, setManualLon2] = useState(region ? String(region.max_lon) : '10')

  // Load available variables catalog from backend
  useEffect(() => {
    explorerApi.variables()
      .then(res => {
        if (Array.isArray(res.data)) {
          setAvailableVars(res.data)
        }
      })
      .catch(() => {})
  }, [])

  // Load saved regions
  useEffect(() => {
    explorerApi.regions()
      .then(r => setSavedRegions(r.data || []))
      .catch(() => {})
  }, [setSavedRegions])

  // Initial fetch if region exists
  useEffect(() => {
    if (region && gridData.length === 0) {
      fetchGrid(region)
      fetchTimeSeries(region)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Currently selected variable details
  const currentVarMeta = availableVars.find(v => v.id === variable)

  const fetchGrid = async (r?: typeof region, src = dataSource) => {
    const reg = r || region
    if (!reg) return
    setLoading(true)
    try {
      const { data } = await explorerApi.grid({
        variable,
        resolution,
        min_lat: reg.min_lat,
        max_lat: reg.max_lat,
        min_lon: reg.min_lon,
        max_lon: reg.max_lon,
        date_start: dateStart,
        date_end: dateEnd,
        min_pixel_reliability: qualityFilter,
        source: src,
      })
      setGridData(data.grid || [])
    } catch (e: any) {
      toast.error('Grid query failed: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  const fetchTimeSeries = async (r?: typeof region, src = dataSource) => {
    const reg = r || region
    if (!reg) return
    setTsLoading(true)
    try {
      const { data } = await explorerApi.timeSeries({
        variable,
        min_lat: reg.min_lat,
        max_lat: reg.max_lat,
        min_lon: reg.min_lon,
        max_lon: reg.max_lon,
        date_start: dateStart,
        date_end: dateEnd,
        min_pixel_reliability: qualityFilter,
        source: src,
      })
      setTimeSeries(data.series || [])
    } catch {
    } finally {
      setTsLoading(false)
    }
  }

  const applyManualRegion = () => {
    const lat1 = parseFloat(manualLat1)
    const lat2 = parseFloat(manualLat2)
    const lon1 = parseFloat(manualLon1)
    const lon2 = parseFloat(manualLon2)

    if (isNaN(lat1) || isNaN(lat2) || isNaN(lon1) || isNaN(lon2)) {
      toast.error('Invalid coordinates. Latitudes must be -90..90 and Longitudes -180..180.')
      return
    }

    const reg = {
      min_lat: Math.min(lat1, lat2),
      max_lat: Math.max(lat1, lat2),
      min_lon: Math.min(lon1, lon2),
      max_lon: Math.max(lon1, lon2),
    }

    if (reg.max_lat - reg.min_lat < 0.01 || reg.max_lon - reg.min_lon < 0.01) {
      toast.error('Selected bounding box is too small.')
      return
    }

    setRegion(reg)
    fetchGrid(reg)
    fetchTimeSeries(reg)
  }

  const loadPreset = (preset: typeof DEMO_PRESETS[0]) => {
    setVariable(preset.variable)
    setDataSource(preset.source as 'local' | 'external')
    const reg = { ...preset.bounds, name: preset.name }
    setRegion(reg)
    setManualLat1(String(preset.bounds.min_lat))
    setManualLat2(String(preset.bounds.max_lat))
    setManualLon1(String(preset.bounds.min_lon))
    setManualLon2(String(preset.bounds.max_lon))
    fetchGrid(reg, preset.source as 'local' | 'external')
    fetchTimeSeries(reg, preset.source as 'local' | 'external')
    toast.success(`Loaded preset: ${preset.name}`)
  }

  const saveRegion = async () => {
    if (!region || !regionName.trim()) return
    setSavingRegion(true)
    try {
      await explorerApi.saveRegion({ ...region, name: regionName.trim() })
      toast.success('Region saved')
      const { data } = await explorerApi.regions()
      setSavedRegions(data || [])
      setRegionName('')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to save region')
    } finally {
      setSavingRegion(false)
    }
  }

  const deleteRegion = async (id: number) => {
    try {
      await explorerApi.deleteRegion(id)
      const { data } = await explorerApi.regions()
      setSavedRegions(data || [])
      toast.success('Region deleted')
    } catch {
      toast.error('Failed to delete region')
    }
  }

  const loadSavedRegion = (r: any) => {
    const reg = { min_lat: r.min_lat, max_lat: r.max_lat, min_lon: r.min_lon, max_lon: r.max_lon, name: r.name }
    setRegion(reg)
    setManualLat1(String(r.min_lat))
    setManualLat2(String(r.max_lat))
    setManualLon1(String(r.min_lon))
    setManualLon2(String(r.max_lon))
    fetchGrid(reg)
    fetchTimeSeries(reg)
  }

  const runAnalysis = async () => {
    if (!region) {
      toast.error('Please define or query a region first.')
      return
    }
    setAnalysisLoading(true)
    try {
      const body = {
        variable,
        min_lat: region.min_lat,
        max_lat: region.max_lat,
        min_lon: region.min_lon,
        max_lon: region.max_lon,
        date_start: dateStart,
        date_end: dateEnd,
        min_pixel_reliability: qualityFilter,
        significance_alpha: significanceAlpha,
        mann_kendall: useMannKendall,
      }
      const { data } = await explorerApi.runAnalysis(body, { source: dataSource })
      setAnalysisResult(data)
      if (data.time_series && data.time_series.length > 0) {
        setTimeSeries(data.time_series)
      }
      toast.success('Earth Change statistical analysis complete!')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Analysis failed')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const handleExportCsv = async () => {
    if (!region) {
      toast.error('Please select a region first.')
      return
    }
    try {
      const params = {
        variable,
        min_lat: region.min_lat,
        max_lat: region.max_lat,
        min_lon: region.min_lon,
        max_lon: region.max_lon,
        date_start: dateStart,
        date_end: dateEnd,
        min_pixel_reliability: qualityFilter,
        significance_alpha: significanceAlpha,
        mann_kendall: useMannKendall,
        source: dataSource,
      }
      const res = await explorerApi.exportCsv(params)
      const csvContent = res.data.csv
      const filename = res.data.filename || `${variable}_${dateStart}_to_${dateEnd}.csv`

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${filename}`)
    } catch (e: any) {
      toast.error('CSV export failed: ' + (e?.response?.data?.detail || e.message))
    }
  }

  const handleExportChartPng = () => {
    const svgEl = document.querySelector('.recharts-wrapper svg') as SVGSVGElement | null
    if (!svgEl) {
      toast.error('No chart found to export.')
      return
    }
    try {
      const svgString = new XMLSerializer().serializeToString(svgEl)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const width = svgEl.clientWidth || 900
        const height = svgEl.clientHeight || 320
        canvas.width = width * 2 // 2x retina
        canvas.height = height * 2
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(2, 2)
          ctx.fillStyle = '#071520'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          const pngUrl = canvas.toDataURL('image/png')
          const a = document.createElement('a')
          a.href = pngUrl
          a.download = `${variable}_timeseries_${dateStart}_${dateEnd}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          toast.success('Chart image downloaded (PNG)')
        }
        URL.revokeObjectURL(url)
      }
      img.src = url
    } catch (e: any) {
      toast.error('Failed to export chart image: ' + e.message)
    }
  }

  const vals = gridData.map(g => g.value)
  const minV = vals.length ? Math.min(...vals) : -0.2
  const maxV = vals.length ? Math.max(...vals) : 1.0

  const toMapPos = (lat: number, lon: number) => ({
    x: ((lon + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  })

  const regionBox = region ? {
    x1: ((region.min_lon + 180) / 360) * 100,
    x2: ((region.max_lon + 180) / 360) * 100,
    y1: ((90 - region.max_lat) / 180) * 100,
    y2: ((90 - region.min_lat) / 180) * 100,
  } : null

  const filteredVars = selectedCategory === 'All'
    ? availableVars
    : availableVars.filter(v => (v.category && v.category.toLowerCase().includes(selectedCategory.toLowerCase())))

  return (
    <div className="app-shell">
      <div className="page-content-full">
        <div className="explorer-layout">
          {/* Sidebar */}
          {showControls && (
            <motion.aside
              className="explorer-sidebar"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="sidebar-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe size={18} style={{ color: 'var(--cyan)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Earth Change Explorer</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    title="Data Detective Guided Wizard"
                    onClick={() => setShowDetectiveModal(!showDetectiveModal)}
                  >
                    <Sparkles size={15} style={{ color: '#FFB800' }} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowControls(false)}>×</button>
                </div>
              </div>

              {/* Data Source Selector */}
              <div className="sidebar-section" style={{ background: 'rgba(54, 214, 231, 0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>Data Source</label>
                  <span style={{ fontSize: '0.68rem', color: dataSource === 'local' ? '#36D6E7' : '#FFB800', fontWeight: 600 }}>
                    {dataSource === 'local' ? '319 Parquet Archive' : 'Multi-Mission NASA'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${dataSource === 'local' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, fontSize: '0.75rem', justifyContent: 'center' }}
                    onClick={() => {
                      setDataSource('local')
                      if (region) { fetchGrid(region, 'local'); fetchTimeSeries(region, 'local'); }
                    }}
                  >
                    <Layers size={13} /> Local MODIS
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${dataSource === 'external' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, fontSize: '0.75rem', justifyContent: 'center' }}
                    onClick={() => {
                      setDataSource('external')
                      if (region) { fetchGrid(region, 'external'); fetchTimeSeries(region, 'external'); }
                    }}
                  >
                    <Globe size={13} /> Multi-Mission
                  </button>
                </div>
              </div>

              {/* Variable Selection */}
              <div className="sidebar-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Earth Science Variable</label>
                  {currentVarMeta?.units && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentVarMeta.units}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
                  {['All', 'Biosphere', 'Atmosphere', 'Hydrology', 'Model'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`btn btn-xs ${selectedCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '0.68rem', padding: '2px 6px' }}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <select
                  className="form-select"
                  value={variable}
                  onChange={e => {
                    const newVar = e.target.value
                    setVariable(newVar)
                    const vItem = availableVars.find(v => v.id === newVar)
                    if (vItem && !vItem.is_local && dataSource === 'local') {
                      setDataSource('external')
                    }
                  }}
                >
                  {(filteredVars.length > 0 ? filteredVars : availableVars).map(v => (
                    <option key={v.id} value={v.id}>
                      {v.id} — {v.name} ({v.mission})
                    </option>
                  ))}
                </select>

                {/* Simple Definition Box for Students */}
                {currentVarMeta && (
                  <div style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.72rem',
                    lineHeight: 1.4,
                    color: 'var(--text-secondary)'
                  }}>
                    <strong style={{ color: 'var(--cyan)' }}>Data Detective Insight: </strong>
                    {currentVarMeta.simple_definition || currentVarMeta.description}
                  </div>
                )}
              </div>

              {/* Guided Demonstration Presets */}
              <div className="sidebar-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Compass size={13} style={{ color: 'var(--cyan)' }} /> Demonstration Scenarios
                  </label>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>1-Click Setup</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {DEMO_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      className="btn btn-ghost btn-sm"
                      style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '6px 8px', fontSize: '0.74rem' }}
                      onClick={() => loadPreset(p)}
                      title={p.description}
                    >
                      <MapPin size={12} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="sidebar-section">
                <label className="form-label">Observation Window (Monthly)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Start Date:</span>
                    <input type="date" className="form-input" value={dateStart}
                      onChange={e => setDateRange(e.target.value, dateEnd)} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>End Date:</span>
                    <input type="date" className="form-input" value={dateEnd}
                      onChange={e => setDateRange(dateStart, e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Quality filter (MODIS) */}
              {dataSource === 'local' && (
                <div className="sidebar-section">
                  <label className="form-label">Quality Filter (Pixel Reliability)</label>
                  <select className="form-select" value={qualityFilter} onChange={e => setQualityFilter(+e.target.value)}>
                    <option value={0}>0 — Good quality only (Strict)</option>
                    <option value={1}>≤1 — Good + Marginal (Moderate)</option>
                    <option value={2}>≤2 — + Snow/Ice Covered</option>
                    <option value={3}>All observations (No QA filter)</option>
                  </select>
                </div>
              )}

              {/* Grid resolution */}
              <div className="sidebar-section">
                <label className="form-label">Spatial Grid Aggregation</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {GRID_RESOLUTIONS.map(r => (
                    <button
                      key={r.value}
                      className={`btn ${resolution === r.value ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem' }}
                      onClick={() => setResolution(r.value)}
                    >{r.label}</button>
                  ))}
                </div>
              </div>

              {/* Bounding box controls */}
              <div className="sidebar-section">
                <label className="form-label">Region Coordinate Bounds</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Min Lat (°S)</label>
                    <input className="form-input" value={manualLat1} onChange={e => setManualLat1(e.target.value)} style={{ padding: '5px 8px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Max Lat (°N)</label>
                    <input className="form-input" value={manualLat2} onChange={e => setManualLat2(e.target.value)} style={{ padding: '5px 8px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Min Lon (°W)</label>
                    <input className="form-input" value={manualLon1} onChange={e => setManualLon1(e.target.value)} style={{ padding: '5px 8px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Max Lon (°E)</label>
                    <input className="form-input" value={manualLon2} onChange={e => setManualLon2(e.target.value)} style={{ padding: '5px 8px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={applyManualRegion}>
                    <Crosshair size={14} /> Query Region
                  </button>
                  {region && (
                    <button className="btn btn-secondary btn-icon" onClick={() => { fetchGrid(); fetchTimeSeries() }} disabled={loading || tsLoading} title="Refresh">
                      <RefreshCw size={14} className={loading || tsLoading ? 'spin-icon' : ''} />
                    </button>
                  )}
                </div>
              </div>

              {/* Saved regions */}
              {region && (
                <div className="sidebar-section">
                  <label className="form-label">Bookmark Region</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="form-input" placeholder="Region name..." value={regionName}
                      onChange={e => setRegionName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveRegion()}
                    />
                    <button className="btn btn-secondary btn-icon" onClick={saveRegion} disabled={!regionName.trim() || savingRegion}>
                      <Save size={14} />
                    </button>
                  </div>
                </div>
              )}

              {savedRegions.length > 0 && (
                <div className="sidebar-section">
                  <label className="form-label">Saved Regions ({savedRegions.length})</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                    {savedRegions.map((r: any) => (
                      <div key={r.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ flex: 1, justifyContent: 'flex-start', fontSize: '0.74rem' }}
                          onClick={() => loadSavedRegion(r)}
                        >
                          <MapPin size={12} /> {r.name}
                        </button>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: 'var(--coral)', flexShrink: 0 }}
                          onClick={() => deleteRegion(r.id)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Statistical Significance Analysis Controls */}
              <div className="sidebar-section" style={{ background: 'rgba(54, 214, 231, 0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TrendingUp size={14} style={{ color: 'var(--cyan)' }} /> Trend Significance Test
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>α = {significanceAlpha}</span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Threshold α:</span>
                  <select
                    className="form-select"
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.74rem' }}
                    value={significanceAlpha}
                    onChange={e => setSignificanceAlpha(parseFloat(e.target.value))}
                  >
                    <option value={0.01}>0.01 (99% Confidence)</option>
                    <option value={0.05}>0.05 (95% Confidence - Standard)</option>
                    <option value={0.10}>0.10 (90% Confidence)</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', cursor: 'pointer', marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={useMannKendall}
                    onChange={e => setUseMannKendall(e.target.checked)}
                  />
                  <span>Run Mann-Kendall Monotonic Test</span>
                </label>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
                  onClick={runAnalysis}
                  disabled={analysisLoading}
                >
                  <Sparkles size={14} />
                  {analysisLoading ? 'Analyzing Change…' : 'Determine Significant Change'}
                </button>
              </div>

              {/* Export Panel */}
              <div className="sidebar-section">
                <label className="form-label">Export & Reporting</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }} onClick={handleExportCsv}>
                    <Download size={13} /> Export CSV
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }} onClick={handleExportChartPng}>
                    <ImageIcon size={13} /> Export PNG
                  </button>
                </div>
              </div>
            </motion.aside>
          )}

          {/* Map & Visualization Area */}
          <div className="explorer-map-area">
            {!showControls && (
              <button className="sidebar-toggle" onClick={() => setShowControls(true)} title="Show sidebar">
                <SlidersHorizontal size={16} />
              </button>
            )}

            {/* Equirectangular map canvas */}
            <div className="world-map">
              <div className="world-map-bg" />

              {/* Render aggregated grid cells */}
              {gridData.map((pt, i) => {
                const pos = toMapPos(pt.lat, pt.lon)
                return (
                  <div
                    key={i}
                    className="grid-cell"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      background: valueToColor(pt.value, minV, maxV),
                      width: `${resolution * 0.55}%`,
                      height: `${resolution * 0.55}%`,
                    }}
                    title={`${variable}: ${pt.value?.toFixed(4)}\nLat: ${pt.lat}°, Lon: ${pt.lon}°\nObs Count: ${pt.count}`}
                  />
                )
              })}

              {/* Bounding box marker */}
              {regionBox && (
                <div className="region-box" style={{
                  left: `${regionBox.x1}%`,
                  top: `${regionBox.y1}%`,
                  width: `${regionBox.x2 - regionBox.x1}%`,
                  height: `${regionBox.y2 - regionBox.y1}%`,
                }}>
                  <span style={{
                    position: 'absolute', top: -20, left: 0,
                    background: 'rgba(7, 21, 32, 0.85)',
                    padding: '2px 6px', borderRadius: 4,
                    fontSize: '0.65rem', color: 'var(--cyan)', border: '1px solid var(--border-blue)'
                  }}>
                    {region?.name || 'Target Region'}
                  </span>
                </div>
              )}

              {/* Loading spinner */}
              {loading && (
                <div className="map-loading">
                  <div className="spinner spinner-lg" />
                  <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Querying {variable} ({dataSource === 'local' ? 'Local Parquet' : 'Multi-Mission'})...</p>
                </div>
              )}

              {/* Empty state */}
              {!loading && gridData.length === 0 && (
                <div className="map-empty">
                  <Globe size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p>Choose a <strong>Demonstration Scenario</strong> or select a bounding box</p>
                  <p style={{ fontSize: '0.78rem', marginTop: 4, color: 'var(--text-muted)' }}>
                    Visualise {variable} changes across time and determine if trends are significant
                  </p>
                </div>
              )}

              {/* Color legend */}
              {gridData.length > 0 && (
                <div className="map-legend">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{variable}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--cyan)' }}>{dataSource === 'local' ? 'MODIS' : 'Mission'}</span>
                  </div>
                  <div className="legend-bar" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>{minV.toFixed(3)}</span>
                    <span>{((minV + maxV) / 2).toFixed(3)}</span>
                    <span>{maxV.toFixed(3)}</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-disabled)', marginTop: 4 }}>
                    {gridData.length.toLocaleString()} grid cells · {resolution}° resolution
                  </div>
                </div>
              )}

              {/* Result badge */}
              {gridData.length > 0 && (
                <div className="map-count-badge">
                  {variable} · {dataSource === 'local' ? 'Local 319-file Parquet' : 'NASA Multi-Mission'} · QA ≤{qualityFilter}
                </div>
              )}
            </div>

            {/* Bottom Time Series & Analysis Panel */}
            <div className="explorer-bottom-panel">
              {timeSeries.length > 0 ? (
                <div style={{ display: 'flex', gap: 16, height: '100%' }}>
                  {/* Chart side */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                          {variable} Time Series & Trendline · {region?.name || 'Selected Region'}
                        </span>
                        {analysisResult?.statistics?.significance && (
                          <span style={{
                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12,
                            background: analysisResult.statistics.is_significant ? 'rgba(0, 221, 68, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                            color: analysisResult.statistics.is_significant ? '#00DD44' : 'var(--text-muted)',
                            border: `1px solid ${analysisResult.statistics.is_significant ? 'rgba(0, 221, 68, 0.4)' : 'rgba(255, 255, 255, 0.15)'}`,
                            fontWeight: 600,
                          }}>
                            {analysisResult.statistics.significance}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {tsLoading && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                        <button className="btn btn-ghost btn-sm" onClick={handleExportChartPng} title="Export chart as PNG">
                          <ImageIcon size={13} /> Save Image
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={handleExportCsv} title="Export CSV dataset">
                          <Download size={13} /> Export CSV
                        </button>
                      </div>
                    </div>

                    <div style={{ flex: 1, minHeight: 0 }}>
                      <TimeSeriesChart data={timeSeries} variable={variable} height={165} showTrend={true} />
                    </div>
                  </div>

                  {/* Scientific Analysis Stats Sidebar */}
                  {analysisResult?.statistics && (
                    <div style={{
                      width: 320,
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderLeft: '1px solid var(--border-blue)',
                      padding: '8px 12px',
                      overflowY: 'auto',
                      fontSize: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} /> Data Detective Verdict
                      </div>

                      <div style={{
                        padding: '6px 8px',
                        background: analysisResult.statistics.is_significant ? 'rgba(0, 221, 68, 0.08)' : 'rgba(255, 184, 0, 0.08)',
                        borderRadius: 6,
                        border: `1px solid ${analysisResult.statistics.is_significant ? 'rgba(0, 221, 68, 0.25)' : 'rgba(255, 184, 0, 0.25)'}`
                      }}>
                        <div style={{ fontWeight: 600, color: analysisResult.statistics.is_significant ? '#00DD44' : '#FFB800' }}>
                          {analysisResult.detective_summary?.is_significant ? 'Significant Trend Detected' : 'No Statistically Significant Trend'}
                        </div>
                        <p style={{ marginTop: 4, lineHeight: 1.35, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                          {analysisResult.detective_summary?.interpretation}
                        </p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 6, borderRadius: 4 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Rate of Change / Year</span>
                          <div style={{ fontWeight: 700, color: '#36D6E7', fontSize: '0.82rem' }}>
                            {analysisResult.statistics.linear?.slope_per_year > 0 ? '+' : ''}
                            {analysisResult.statistics.linear?.slope_per_year?.toFixed(4)}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 6, borderRadius: 4 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>p-value (Linear)</span>
                          <div style={{ fontWeight: 700, color: analysisResult.statistics.linear?.p_value < significanceAlpha ? '#00DD44' : '#FFB800', fontSize: '0.82rem' }}>
                            {analysisResult.statistics.linear?.p_value < 0.0001
                              ? analysisResult.statistics.linear?.p_value?.toExponential(2)
                              : analysisResult.statistics.linear?.p_value?.toFixed(4)}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 6, borderRadius: 4 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>R² Explained Variance</span>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                            {(analysisResult.statistics.linear?.r_squared * 100)?.toFixed(1)}%
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 6, borderRadius: 4 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Mann-Kendall Trend</span>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', textTransform: 'capitalize' }}>
                            {analysisResult.statistics.mann_kendall?.trend || 'Not computed'}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.68rem', color: 'var(--text-disabled)', marginTop: 'auto' }}>
                        Observations: {analysisResult.statistics.observations} months · OLS Degrees of Freedom: {analysisResult.statistics.linear?.degrees_of_freedom}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 8 }}>
                  <TrendingUp size={16} /> Select a region or preset to extract the monthly time-series and run statistical trend tests.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Data Detective Guided Wizard Modal */}
      <AnimatePresence>
        {showDetectiveModal && (
          <div className="modal-backdrop" onClick={() => setShowDetectiveModal(false)}>
            <motion.div
              className="modal-card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 650 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={20} style={{ color: '#FFB800' }} />
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>NASA Data Detective Guide</h3>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowDetectiveModal(false)}>×</button>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                Welcome, Data Detective! Changes in Earth’s environmental system can rise in one region and fall in another even when driven by the same global process. Select a research question below to investigate:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DEMO_PRESETS.map((preset, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-blue)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => {
                      loadPreset(preset)
                      setShowDetectiveModal(false)
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cyan)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-blue)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--cyan)', fontSize: '0.88rem' }}>{preset.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 6px', borderRadius: 4 }}>
                        {preset.variable}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {preset.description}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .explorer-layout {
          display: flex;
          height: calc(100vh - var(--nav-height));
          overflow: hidden;
        }
        .explorer-sidebar {
          width: 320px;
          background: var(--glass-bg-heavy);
          backdrop-filter: blur(24px);
          border-right: 1px solid var(--border-subtle);
          overflow-y: auto;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          z-index: 20;
        }
        .sidebar-header {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          background: var(--glass-bg-heavy);
          z-index: 2;
        }
        .sidebar-section {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sidebar-toggle {
          position: absolute;
          left: 12px;
          top: 16px;
          z-index: 15;
          background: var(--card-blue);
          border: 1px solid var(--border-blue);
          color: var(--text-primary);
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .explorer-map-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .world-map {
          flex: 1;
          width: 100%;
          position: relative;
          overflow: hidden;
          background: #071520;
          min-height: 250px;
        }
        .world-map-bg {
          position: absolute; inset: 0;
          background-image: url('/overview_hero.png');
          background-size: cover;
          background-position: center;
          opacity: 0.25;
          filter: saturate(0.4) brightness(0.5);
        }
        .grid-cell {
          position: absolute;
          border-radius: 2px;
          transform: translate(-50%, -50%);
          cursor: pointer;
          transition: opacity var(--transition-fast);
          min-width: 3px;
          min-height: 3px;
        }
        .grid-cell:hover { opacity: 0.85; transform: translate(-50%,-50%) scale(1.4); z-index: 10; }
        .region-box {
          position: absolute;
          border: 2px solid var(--cyan);
          background: rgba(54, 214, 231, 0.08);
          border-radius: 2px;
          pointer-events: none;
        }
        .map-loading, .map-empty {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          color: var(--text-secondary);
          font-size: 0.9rem;
          pointer-events: none;
        }
        .map-legend {
          position: absolute;
          bottom: 12px;
          right: 16px;
          background: var(--glass-bg-heavy);
          backdrop-filter: blur(14px);
          border: 1px solid var(--border-blue);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          min-width: 170px;
          z-index: 10;
        }
        .legend-bar {
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(90deg, #FF3333, #FFAA00, #00DD44);
          margin-bottom: 4px;
        }
        .map-count-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: var(--glass-bg-heavy);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border-blue);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 0.74rem;
          color: var(--cyan);
          font-weight: 600;
          z-index: 10;
        }
        .explorer-bottom-panel {
          height: 230px;
          background: var(--glass-bg-heavy);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--border-blue);
          padding: 10px 16px;
          flex-shrink: 0;
        }
        .modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
        }
        .modal-card {
          background: var(--card-blue);
          border: 1px solid var(--border-blue);
          border-radius: 12px;
          padding: 24px;
          width: 90%;
        }
        .spin-icon { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
