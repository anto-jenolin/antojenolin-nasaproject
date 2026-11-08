import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, TrendingUp, Download, AlertTriangle, RefreshCw, Globe } from 'lucide-react'
import { explorerApi, datasetApi } from '../api/client'
import { useRegion } from '../contexts/RegionContext'
import GlassCard from '../components/shared/GlassCard'
import TimeSeriesChart from '../components/charts/TimeSeriesChart'
import toast from 'react-hot-toast'

export default function InsightsPage() {
  const { region, dateStart, dateEnd, variable, qualityFilter } = useRegion()
  const [timeSeries, setTimeSeries] = useState<any[]>([])
  const [quality, setQuality] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'trends' | 'quality' | 'export'>('trends')

  const fetchTrends = async () => {
    if (!region) { toast.error('Select a region in Earth Explorer first'); return }
    setLoading(true)
    try {
      const [tsRes, qualRes] = await Promise.all([
        explorerApi.timeSeries({
          variable, min_lat: region.min_lat, max_lat: region.max_lat,
          min_lon: region.min_lon, max_lon: region.max_lon,
          date_start: dateStart, date_end: dateEnd,
          min_pixel_reliability: qualityFilter,
        }),
        datasetApi.quality({
          min_lat: region.min_lat, max_lat: region.max_lat,
          min_lon: region.min_lon, max_lon: region.max_lon,
          date_start: dateStart, date_end: dateEnd,
        }),
      ])
      setTimeSeries(tsRes.data.series || [])
      setQuality(qualRes.data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to load insights')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (region) fetchTrends()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region])

  const exportCSV = () => {
    if (!timeSeries.length) return
    const header = Object.keys(timeSeries[0]).join(',')
    const rows = timeSeries.map(r => Object.values(r).join(',')).join('\n')
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `terrapulse_${variable}_timeseries.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  // Compute simple linear trend
  const computeTrend = () => {
    if (timeSeries.length < 2) return null
    const vals = timeSeries.filter(d => d.mean !== null).map((d, i) => ({ x: i, y: d.mean }))
    const n = vals.length
    const sumX = vals.reduce((s, d) => s + d.x, 0)
    const sumY = vals.reduce((s, d) => s + d.y, 0)
    const sumXY = vals.reduce((s, d) => s + d.x * d.y, 0)
    const sumX2 = vals.reduce((s, d) => s + d.x * d.x, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    return slope
  }

  const trend = computeTrend()

  return (
    <div className="app-shell">
      <div style={{ marginTop: 'var(--nav-height)' }}>
        {/* Hero */}
        <div style={{
          padding: '48px 40px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'linear-gradient(180deg, rgba(124,231,165,0.04) 0%, transparent 100%)',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <BarChart2 size={28} style={{ color: 'var(--sci-green)' }} />
            <h1 style={{ fontSize: '2rem' }}>Insights</h1>
          </div>
          <p>Regional vegetation trends, quality summaries, and exportable data derived from MODIS MOD13C2 observations.</p>
          {region && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-green">
                <Globe size={11} /> {region.name || `[${region.min_lat}°, ${region.max_lat}°] × [${region.min_lon}°, ${region.max_lon}°]`}
              </span>
              <span className="badge badge-cyan">{dateStart} → {dateEnd}</span>
              <span className="badge badge-purple">{variable}</span>
            </div>
          )}
          {!region && (
            <div style={{ marginTop: 12 }}>
              <span className="badge badge-amber">⚠ No region selected — visit Earth Explorer first</span>
            </div>
          )}
        </div>

        <div className="page-content">
          {/* Tab nav */}
          <div className="tab-nav">
            <button className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>
              <TrendingUp size={14} /> Time Series Trends
            </button>
            <button className={`tab-btn ${activeTab === 'quality' ? 'active' : ''}`} onClick={() => setActiveTab('quality')}>
              <AlertTriangle size={14} /> Data Quality
            </button>
            <button className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`} onClick={() => setActiveTab('export')}>
              <Download size={14} /> Export
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={fetchTrends} disabled={!region || loading}>
              {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <RefreshCw size={14} />}
              {loading ? 'Loading…' : 'Refresh Data'}
            </button>
          </div>

          {!region && (
            <GlassCard>
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Globe size={64} style={{ opacity: 0.2, marginBottom: 16 }} />
                <h3 style={{ color: 'var(--text-secondary)' }}>No Region Selected</h3>
                <p>Visit the Earth Explorer, set a bounding box, and query a region to see insights here.</p>
                <a href="/explorer" className="btn btn-primary" style={{ marginTop: 20 }}>Open Earth Explorer</a>
              </div>
            </GlassCard>
          )}

          {/* Trends tab */}
          {activeTab === 'trends' && region && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {timeSeries.length > 0 ? (
                <>
                  {/* Summary stats */}
                  <div className="grid-4" style={{ marginBottom: 24 }}>
                    <div className="stat-card stat-card-accent">
                      <div className="stat-card-label">Months in Series</div>
                      <div className="stat-card-value">{timeSeries.length}</div>
                    </div>
                    <div className="stat-card stat-card-accent">
                      <div className="stat-card-label">Mean {variable}</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
                        {(timeSeries.filter(d => d.mean !== null).reduce((s, d) => s + d.mean, 0) / timeSeries.filter(d => d.mean !== null).length).toFixed(4)}
                      </div>
                    </div>
                    <div className="stat-card stat-card-accent">
                      <div className="stat-card-label">Linear Trend</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem', color: trend && trend > 0 ? 'var(--sci-green)' : trend && trend < 0 ? 'var(--coral)' : 'var(--text-primary)' }}>
                        {trend ? `${trend > 0 ? '+' : ''}${trend.toFixed(5)}/mo` : 'N/A'}
                      </div>
                    </div>
                    <div className="stat-card stat-card-accent">
                      <div className="stat-card-label">Total Obs.</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
                        {timeSeries.reduce((s, d) => s + (d.pixel_count || 0), 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <GlassCard style={{ marginBottom: 24 }}>
                    <div className="section-title" style={{ marginBottom: 16 }}>{variable} Time Series · MODIS MOD13C2</div>
                    <TimeSeriesChart data={timeSeries} variable={variable} height={280} />
                    <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--deep-space)', borderRadius: 8 }}>
                      ⚠ Observed trends reflect the MODIS dataset for this region and period. Observed patterns should not be attributed to specific environmental causes without additional analysis.
                      Product: NASA MODIS MOD13C2 Collection 6.1 · Resolution: 0.05° · Scale factors already applied.
                    </div>
                  </GlassCard>

                  {/* Monthly breakdown */}
                  <GlassCard padding="0">
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span className="section-title">Monthly Summary Table</span>
                    </div>
                    <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Mean {variable}</th>
                            <th>Std Dev</th>
                            <th>Pixel Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeSeries.map((d: any, i: number) => (
                            <tr key={i}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.date}</td>
                              <td style={{ fontFamily: 'monospace', color: 'var(--sci-green)' }}>{d.mean?.toFixed(4) ?? 'NaN'}</td>
                              <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>±{d.std?.toFixed(4) ?? '—'}</td>
                              <td style={{ color: 'var(--text-muted)' }}>{d.pixel_count?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>
                </>
              ) : (
                !loading && (
                  <GlassCard>
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <TrendingUp size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                      <p style={{ color: 'var(--text-muted)' }}>Click "Refresh Data" to load time series for your selected region.</p>
                    </div>
                  </GlassCard>
                )
              )}
            </motion.div>
          )}

          {/* Quality tab */}
          {activeTab === 'quality' && region && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {quality && !quality.error ? (
                <div className="grid-3" style={{ gap: 24 }}>
                  <GlassCard>
                    <div className="stat-card-label">Total Observations</div>
                    <div className="stat-card-value">{quality.total_rows?.toLocaleString()}</div>
                    <div className="stat-card-sub">Valid NDVI: {quality.valid_ndvi?.toLocaleString()}</div>
                  </GlassCard>
                  <GlassCard>
                    <div className="stat-card-label">Null NDVI Rate</div>
                    <div className="stat-card-value" style={{ color: quality.null_ndvi_pct > 30 ? 'var(--coral)' : 'var(--sci-green)' }}>
                      {quality.null_ndvi_pct}%
                    </div>
                    <div className="stat-card-sub">Fill-value or no observation</div>
                  </GlassCard>
                  <GlassCard>
                    <div className="stat-card-label">NDVI Statistics</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                      <div><div className="stat-card-label">Mean</div><strong>{quality.ndvi_stats?.mean}</strong></div>
                      <div><div className="stat-card-label">Min</div><strong>{quality.ndvi_stats?.min}</strong></div>
                      <div><div className="stat-card-label">Max</div><strong>{quality.ndvi_stats?.max}</strong></div>
                    </div>
                  </GlassCard>
                  {quality.pixel_reliability && (
                    <GlassCard style={{ gridColumn: '1 / -1' }}>
                      <div className="section-title" style={{ marginBottom: 16 }}>Pixel Reliability Distribution</div>
                      <div className="grid-4">
                        {[
                          { label: 'Good Data (0)', key: 'good', color: 'var(--sci-green)' },
                          { label: 'Marginal (1)', key: 'marginal', color: 'var(--amber)' },
                          { label: 'Snow/Ice (2)', key: 'snow_ice', color: 'var(--cyan)' },
                          { label: 'Cloudy (3)', key: 'cloudy', color: 'var(--coral)' },
                        ].map(({ label, key, color }) => (
                          <div key={key} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>
                              {quality.pixel_reliability[key]?.toLocaleString() || 0}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                </div>
              ) : quality?.error ? (
                <GlassCard>
                  <p style={{ color: 'var(--coral)' }}>{quality.error}</p>
                </GlassCard>
              ) : (
                <GlassCard>
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <p style={{ color: 'var(--text-muted)' }}>Click "Refresh Data" to compute quality report.</p>
                  </div>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* Export tab */}
          {activeTab === 'export' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GlassCard>
                <div className="section-title" style={{ marginBottom: 20 }}>Export Data</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: '16px 20px', background: 'var(--deep-space)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Time Series CSV</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      Export the {variable} monthly time series for the selected region as CSV.
                      Includes date, mean, std, pixel count.
                    </p>
                    <button className="btn btn-primary" onClick={exportCSV} disabled={timeSeries.length === 0}>
                      <Download size={14} /> Download {variable} Time Series
                    </button>
                    {timeSeries.length === 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--amber)', marginTop: 8 }}>Load data in the Trends tab first.</p>
                    )}
                  </div>

                  <div style={{ padding: '16px 20px', background: 'var(--deep-space)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Data Provenance</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      <p><strong style={{ color: 'var(--text-secondary)' }}>Product:</strong> NASA MODIS MOD13C2 Collection 6.1</p>
                      <p><strong style={{ color: 'var(--text-secondary)' }}>Resolution:</strong> 0.05° (~5.5 km at equator), global CMG grid</p>
                      <p><strong style={{ color: 'var(--text-secondary)' }}>Region:</strong> {region ? `[${region.min_lat}°, ${region.max_lat}°] × [${region.min_lon}°, ${region.max_lon}°]` : 'Not selected'}</p>
                      <p><strong style={{ color: 'var(--text-secondary)' }}>Period:</strong> {dateStart} to {dateEnd}</p>
                      <p><strong style={{ color: 'var(--text-secondary)' }}>Variable:</strong> {variable}</p>
                      <p><strong style={{ color: 'var(--text-secondary)' }}>Quality filter:</strong> Pixel Reliability ≤ {qualityFilter}</p>
                      <p><strong style={{ color: 'var(--text-secondary)' }}>Processing:</strong> Scale factors already applied. Fill values replaced with NaN during HDF→Parquet conversion.</p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
