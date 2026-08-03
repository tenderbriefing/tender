/** Date helpers for procurement UX (countdowns, closing soon, briefing week). */

/** SA wall-clock timezone used across the product (no DST). */
export const PROCUREMENT_TIMEZONE = 'Africa/Johannesburg'
/** Fixed offset for Africa/Johannesburg (UTC+2 year-round). */
const SAST_OFFSET = '+02:00'

export function parseProcurementDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Parse `HH:mm`, `H:mm`, optional AM/PM — same conventions as calendar export. */
export function parseBriefingTimeParts(
  time?: string | null
): { hours: number; minutes: number } | null {
  if (!time) return null
  const cleaned = time.trim().toUpperCase()
  if (!cleaned || cleaned === '—') return null
  const match = cleaned.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?/)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridian = match[3]
  if (meridian === 'PM' && hours < 12) hours += 12
  if (meridian === 'AM' && hours === 12) hours = 0
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

function sastCalendarDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PROCUREMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Resolve the briefing instant used for public catalogue cut-off.
 * Prefer a full ISO `briefingDate`; date-only values (+ optional `briefingTime`)
 * are interpreted in Africa/Johannesburg. Date-only without time remains listable
 * until end of that SAST calendar day.
 */
export function resolveBriefingDateTime(
  briefingDate?: string | null,
  briefingTime?: string | null
): Date | null {
  if (!briefingDate?.trim()) return null
  const raw = briefingDate.trim()
  const time = parseBriefingTimeParts(briefingTime)

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (time) {
      const iso = `${raw}T${pad2(time.hours)}:${pad2(time.minutes)}:00${SAST_OFFSET}`
      return parseProcurementDate(iso)
    }
    return parseProcurementDate(`${raw}T23:59:59${SAST_OFFSET}`)
  }

  const parsed = parseProcurementDate(raw)
  if (!parsed) return null

  const hasExplicitClock = /T\d{2}:\d{2}/.test(raw)
  const isUtcMidnight =
    parsed.getUTCHours() === 0 &&
    parsed.getUTCMinutes() === 0 &&
    parsed.getUTCSeconds() === 0

  if (time && (!hasExplicitClock || isUtcMidnight)) {
    const ymd = sastCalendarDate(parsed)
    const iso = `${ymd}T${pad2(time.hours)}:${pad2(time.minutes)}:00${SAST_OFFSET}`
    return parseProcurementDate(iso)
  }

  return parsed
}

/**
 * True when the briefing datetime is strictly before `now`.
 * Unparseable / missing briefing dates are treated as past for public listing.
 */
export function isBriefingPast(
  briefingDate?: string | null,
  briefingTime?: string | null,
  now: Date = new Date()
): boolean {
  const instant = resolveBriefingDateTime(briefingDate, briefingTime)
  if (!instant) return true
  return instant.getTime() < now.getTime()
}

/** Public catalogue cut-off: briefing datetime still at or after `now`. */
export function hasUpcomingBriefing(
  briefingDate?: string | null,
  briefingTime?: string | null,
  now: Date = new Date()
): boolean {
  return !isBriefingPast(briefingDate, briefingTime, now)
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

export function formatBriefingTime(date?: string | null, time?: string | null): string {
  const explicit = time?.trim()
  if (explicit && explicit !== '—') return explicit

  const d = parseProcurementDate(date)
  if (!d) return ''

  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes()
  if (hours === 0 && minutes === 0) return ''

  return d.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  })
}

export function formatProcurementDateTime(date?: string | null, time?: string | null): string {
  const datePart = formatProcurementDate(date)
  if (datePart === '—') return '—'

  const timePart = formatBriefingTime(date, time)
  if (!timePart) return datePart

  return `${datePart} at ${timePart}`
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
