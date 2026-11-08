import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Area, AreaChart, Legend
} from 'recharts'

export interface TimeSeriesDataPoint {
  date: string
  mean: number | null
  trend?: number | null
  std?: number | null
  pixel_count?: number
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[]
  variable?: string
  height?: number
  showArea?: boolean
  showTrend?: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(10, 25, 41, 0.95)',
      border: '1px solid rgba(54, 214, 231, 0.3)',
      backdropFilter: 'blur(10px)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '0.82rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      zIndex: 100,
    }}>
      <p style={{ color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#cbd5e1' }}>{p.name}:</span>
          <strong style={{ color: p.color }}>
            {typeof p.value === 'number' ? p.value.toFixed(4) : '—'}
          </strong>
        </div>
      ))}
    </div>
  )
}

export default function TimeSeriesChart({
  data,
  variable = 'NDVI',
  height = 280,
  showArea = true,
  showTrend = true,
}: TimeSeriesChartProps) {
  if (!data?.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No time-series observations available
      </div>
    )
  }

  const hasTrend = showTrend && data.some(d => d.trend !== undefined && d.trend !== null)
  const Chart = showArea ? AreaChart : LineChart

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#36D6E7" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#36D6E7" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => v?.slice(0, 7)}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          stroke="rgba(255, 255, 255, 0.15)"
        />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="top"
          height={24}
          wrapperStyle={{ fontSize: '0.75rem', paddingBottom: 4 }}
        />
        {showArea ? (
          <Area
            type="monotone"
            dataKey="mean"
            name={`Observed ${variable}`}
            stroke="#36D6E7"
            strokeWidth={2}
            fill="url(#primaryGrad)"
            dot={false}
            connectNulls={true}
          />
        ) : (
          <Line
            type="monotone"
            dataKey="mean"
            name={`Observed ${variable}`}
            stroke="#36D6E7"
            strokeWidth={2}
            dot={false}
            connectNulls={true}
          />
        )}
        {hasTrend && (
          <Line
            type="linear"
            dataKey="trend"
            name="Fitted Trendline"
            stroke="#FFB800"
            strokeWidth={2.5}
            strokeDasharray="5 5"
            dot={false}
            connectNulls={true}
          />
        )}
        <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.15)" strokeDasharray="4 4" />
      </Chart>
    </ResponsiveContainer>
  )
}
