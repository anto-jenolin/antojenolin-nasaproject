import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine
} from 'recharts'

interface Point { actual: number; predicted: number }

interface ActualVsPredictedProps {
  data: Point[]
  height?: number
  target?: string
}

export default function ActualVsPredicted({ data, height = 300, target = 'NDVI' }: ActualVsPredictedProps) {
  if (!data?.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No prediction data
      </div>
    )
  }

  const allVals = data.flatMap(d => [d.actual, d.predicted])
  const minV = Math.min(...allVals) - 0.02
  const maxV = Math.max(...allVals) + 0.02

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="actual"
          name={`Actual ${target}`}
          domain={[minV, maxV]}
          label={{ value: 'Actual', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 11 }}
          tick={{ fontSize: 10 }} tickLine={false}
        />
        <YAxis
          dataKey="predicted"
          name={`Predicted ${target}`}
          domain={[minV, maxV]}
          label={{ value: 'Predicted', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
          tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            background: 'var(--card-blue)',
            border: '1px solid var(--border-blue)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem'
          }}
          formatter={(value: any) => (value !== undefined && value !== null ? Number(value).toFixed(4) : '')}
        />
        <ReferenceLine
          segment={[{ x: minV, y: minV }, { x: maxV, y: maxV }]}
          stroke="var(--coral)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
        <Scatter data={data} fill="#36D6E7" fillOpacity={0.5} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
