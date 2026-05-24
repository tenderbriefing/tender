import { countdownLabel } from '@/lib/procurement/dates'

type CountdownVariant = 'briefing' | 'closing' | 'neutral'

const variantStyles: Record<CountdownVariant, string> = {
  briefing: 'border-amber-300 bg-amber-50 text-amber-900',
  closing: 'border-red-300 bg-red-50 text-red-900',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
}

export default function CountdownBadge({
  targetDate,
  variant = 'neutral',
  prefix,
}: {
  targetDate?: string | null
  variant?: CountdownVariant
  prefix?: string
}) {
  const label = countdownLabel(targetDate)
  if (!label || label === 'Closed') return null

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${variantStyles[variant]}`}
    >
      {prefix ? `${prefix} ` : ''}
      {label}
    </span>
  )
}
