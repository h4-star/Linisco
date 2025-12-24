import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
  }
  delay?: number
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, delay = 0 }: StatCardProps) {
  return (
    <div 
      className="card fade-in" 
      style={{ animationDelay: `${delay * 0.1}s`, opacity: 0 }}
    >
      <div className="card-header">
        <span className="card-title">
          <Icon size={20} />
          {title}
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-label">{subtitle}</div>}
      {trend && (
        <div className={`stat-change ${trend.value >= 0 ? 'positive' : 'negative'}`}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}% {trend.label}
        </div>
      )}
    </div>
  )
}

