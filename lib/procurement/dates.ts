/** Date helpers for procurement UX (countdowns, closing soon, briefing week). */

export function parseProcurementDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function daysUntil(value?: string | null): number | null {
  const d = parseProcurementDate(value)
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function formatProcurementDate(value?: string | null): string {
  const d = parseProcurementDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatProcurementDateTime(date?: string | null, time?: string | null): string {
  const datePart = formatProcurementDate(date)
  if (!time || time === '—') return datePart
  return `${datePart} · ${time}`
}

export function isClosingSoon(closingDate?: string | null, withinDays = 7): boolean {
  const days = daysUntil(closingDate)
  return days !== null && days >= 0 && days <= withinDays
}

export function isBriefingThisWeek(briefingDate?: string | null): boolean {
  const d = parseProcurementDate(briefingDate)
  if (!d) return false
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return d >= start && d <= end
}

export function isBriefingToday(briefingDate?: string | null): boolean {
  const d = parseProcurementDate(briefingDate)
  if (!d) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function countdownLabel(targetDate?: string | null): string | null {
  const days = daysUntil(targetDate)
  if (days === null) return null
  if (days < 0) return 'Closed'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}
