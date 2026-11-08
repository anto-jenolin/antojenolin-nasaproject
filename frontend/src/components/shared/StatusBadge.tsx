type BadgeVariant = 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'default'

const STATUS_MAP: Record<string, BadgeVariant> = {
  completed: 'green',
  running: 'cyan',
  pending: 'amber',
  failed: 'red',
  active: 'green',
  inactive: 'red',
  admin: 'purple',
  user: 'default',
  good: 'green',
  marginal: 'amber',
}

interface StatusBadgeProps {
  status: string
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, variant, size = 'md' }: StatusBadgeProps) {
  const v = variant || STATUS_MAP[status.toLowerCase()] || 'default'
  const cls = v === 'default' ? '' : `badge-${v}`
  const style: React.CSSProperties = size === 'sm' ? { fontSize: '0.68rem', padding: '2px 7px' } : {}
  return (
    <span className={`badge ${cls}`} style={style}>
      {status}
    </span>
  )
}
