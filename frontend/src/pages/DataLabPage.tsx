import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Database, Search, Eye, BarChart2 } from 'lucide-react'
import { datasetApi } from '../api/client'
import { useRegion } from '../contexts/RegionContext'
import GlassCard from '../components/shared/GlassCard'
// import StatusBadge from '../components/shared/StatusBadge' // Removed unused import
import toast from 'react-hot-toast'

type Tab = 'catalog' | 'schema' | 'preview' | 'quality'

export default function DataLabPage() {
  const { region, dateStart, dateEnd, setDateRange } = useRegion()
  const [tab, setTab] = useState<Tab>('catalog')
  const [catalog, setCatalog] = useState<any>(null)
  const [schema, setSchema] = useState<any>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [quality, setQuality] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [previewLimit, setPreviewLimit] = useState(200)
  const [search, setSearch] = useState('')

  useEffect(() => { datasetApi.catalog().then(r => setCatalog(r.data)).catch(() => {}) }, [])
  useEffect(() => { datasetApi.schema().then(r => setSchema(r.data)).catch(() => {}) }, [])

  const loadPreview = async () => {
    setLoading(true)
    try {
      const { data } = await datasetApi.preview({
        min_lat: region?.min_lat, max_lat: region?.max_lat,
        min_lon: region?.min_lon, max_lon: region?.max_lon,
        date_start: dateStart, date_end: dateEnd,
        limit: previewLimit,
      })
      setPreview(data.rows || [])
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Preview failed')
    } finally { setLoading(false) }
  }

  const loadQuality = async () => {
    setLoading(true)
    try {
      const { data } = await datasetApi.quality({
        min_lat: region?.min_lat, max_lat: region?.max_lat,
        min_lon: region?.min_lon, max_lon: region?.max_lon,
        date_start: dateStart, date_end: dateEnd,
      })
      setQuality(data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Quality report failed')
    } finally { setLoading(false) }
  }

  const filteredFiles = catalog?.files?.filter((f: any) =>
    f.filename.toLowerCase().includes(search.toLowerCase()) ||
    f.date.includes(search)
  ) || []

  return (
    <div className="app-shell">
      <div className="page-content">
        {/* Header */}
        <div className="page-hero" style={{ marginBottom: 32, borderRadius: 'var(--radius-lg)', padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Database size={28} style={{ color: 'var(--sci-green)' }} />
            <h1 style={{ fontSize: '2rem' }}>Data Lake</h1>
          </div>
          <p>Explore the 319-file MODIS MOD13C2 dataset — inspect schema, preview records, and run quality reports.</p>
          {catalog && (
            <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
              <span className="badge badge-green">{catalog.total_files} Files</span>
              <span className="badge badge-cyan">{catalog.total_size_gb?.toFixed(1)} GB</span>
              <span className="badge badge-purple">0.05° Resolution</span>
              <span className="badge badge-amber">Scale factors applied</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="tab-nav">
          {([
            { id: 'catalog', label: 'File Catalog', icon: Database },
            { id: 'schema', label: 'Schema', icon: Eye },
            { id: 'preview', label: 'Data Preview', icon: Search },
            { id: 'quality', label: 'Quality Report', icon: BarChart2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`tab-btn ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Catalog */}
        {tab === 'catalog' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Filter by filename or date…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                {filteredFiles.length} / {catalog?.total_files || 0} files
              </span>
            </div>
            <GlassCard padding="0">
              <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Date</th>
                      <th>Size (MB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.slice(0, 200).map((f: any, i: number) => (
                      <tr key={i}>
                        <td><code style={{ fontSize: '0.78rem', color: 'var(--cyan)' }}>{f.filename}</code></td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{f.date}</td>
                        <td>{f.size_mb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Schema */}
        {tab === 'schema' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {schema ? (
              <GlassCard padding="0">
                <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Column</th>
                        <th>Data Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schema.columns?.map((c: any, i: number) => (
                        <tr key={c.name}>
                          <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{i + 1}</td>
                          <td>
                            <code style={{ color: 'var(--cyan)', fontWeight: 600, fontSize: '0.85rem' }}>{c.name}</code>
                          </td>
                          <td><span className="badge badge-purple">{c.type}</span></td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{c.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            ) : <div className="skeleton" style={{ height: 200 }} />}
          </motion.div>
        )}

        {/* Preview */}
        {tab === 'preview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GlassCard style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Date Start</label>
                  <input type="date" className="form-input" value={dateStart} onChange={e => setDateRange(e.target.value, dateEnd)} />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Date End</label>
                  <input type="date" className="form-input" value={dateEnd} onChange={e => setDateRange(dateStart, e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: '0 0 100px' }}>
                  <label className="form-label">Limit</label>
                  <input type="number" className="form-input" value={previewLimit} min={10} max={10000}
                    onChange={e => setPreviewLimit(+e.target.value)} />
                </div>
                {region && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--sci-green)' }}>
                    Region: [{region.min_lat}°,{region.max_lat}°] × [{region.min_lon}°,{region.max_lon}°]
                  </div>
                )}
                <button className="btn btn-primary" onClick={loadPreview} disabled={loading}>
                  {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Eye size={14} />}
                  {loading ? 'Loading…' : 'Load Preview'}
                </button>
              </div>
            </GlassCard>

            {preview.length > 0 && (
              <GlassCard padding="0">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{preview.length} rows</span>
                </div>
                <div style={{ maxHeight: '55vh', overflowX: 'auto', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>{preview[0] && Object.keys(preview[0]).map(k => <th key={k}>{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v: any, j) => (
                            <td key={j} style={{ fontFamily: typeof v === 'number' ? 'monospace' : undefined }}>
                              {v === null || v === undefined ? <span style={{ color: 'var(--text-disabled)' }}>NaN</span> :
                                typeof v === 'number' ? v.toFixed(4) : String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}

        {/* Quality */}
        {tab === 'quality' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ marginBottom: 20 }}>
              <button className="btn btn-primary" onClick={loadQuality} disabled={loading}>
                {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <BarChart2 size={14} />}
                {loading ? 'Computing…' : 'Run Quality Report'}
              </button>
              {!region && <span style={{ marginLeft: 12, fontSize: '0.82rem', color: 'var(--amber)' }}>No region selected — will query globally (slow)</span>}
            </div>

            {quality && !quality.error && (
              <div className="grid-3" style={{ marginBottom: 20 }}>
                <GlassCard>
                  <div className="stat-card-label">Total Observations</div>
                  <div className="stat-card-value">{quality.total_rows?.toLocaleString()}</div>
                  <div className="stat-card-sub">Valid NDVI: {quality.valid_ndvi?.toLocaleString()}</div>
                </GlassCard>
                <GlassCard>
                  <div className="stat-card-label">Null NDVI</div>
                  <div className="stat-card-value" style={{ color: quality.null_ndvi_pct > 30 ? 'var(--coral)' : 'var(--sci-green)' }}>
                    {quality.null_ndvi_pct}%
                  </div>
                  <div className="stat-card-sub">of observations are missing</div>
                </GlassCard>
                <GlassCard>
                  <div className="stat-card-label">NDVI Statistics</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div><div className="stat-card-label">Mean</div><strong>{quality.ndvi_stats?.mean}</strong></div>
                    <div><div className="stat-card-label">Min</div><strong>{quality.ndvi_stats?.min}</strong></div>
                    <div><div className="stat-card-label">Max</div><strong>{quality.ndvi_stats?.max}</strong></div>
                  </div>
                </GlassCard>
              </div>
            )}

            {quality?.pixel_reliability && (
              <GlassCard>
                <div className="section-title" style={{ marginBottom: 16 }}>Pixel Reliability Distribution</div>
                <div className="grid-4">
                  {[
                    { label: 'Good Data', key: 'good', color: 'var(--sci-green)' },
                    { label: 'Marginal', key: 'marginal', color: 'var(--amber)' },
                    { label: 'Snow / Ice', key: 'snow_ice', color: 'var(--cyan)' },
                    { label: 'Cloudy', key: 'cloudy', color: 'var(--coral)' },
                  ].map(({ label, key, color }) => (
                    <div key={key} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{quality.pixel_reliability[key]?.toLocaleString() || 0}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {quality?.error && (
              <div style={{ color: 'var(--coral)', padding: 20 }}>{quality.error}</div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
