import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from 'recharts'

interface FeatureImportanceChartProps {
  // Accept either a Record or an array of {name, value} objects.
  data: Record<string, number> | Array<{ name: string; value: number }>;
  height?: number;
  // title prop removed (unused)
}

export default function FeatureImportanceChart({ data, height = 280 }: FeatureImportanceChartProps) {
  // Normalize data to an array of {name, value} regardless of input shape
  const normalized = Array.isArray(data)
    ? data.map(item => ({ name: item.name, value: Math.abs(item.value) }))
    : Object.entries(data)
        .map(([name, value]) => ({ name, value: Math.abs(value as number) }));
  const sorted = normalized.sort((a, b) => b.value - a.value);

  const COLORS = [
    '#36D6E7', '#7CE7A5', '#FFCB74', '#A78BFA',
    '#FF9F7F', '#38BDF8', '#F472B6', '#34D399'
  ]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip
          formatter={(value:any) => (value !== undefined && value !== null ? Number(value).toFixed(4) : '')}
          contentStyle={{
            background: 'var(--card-blue)',
            border: '1px solid var(--border-blue)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem'
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {sorted.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
