import {
  PROCUREMENT_TIMEZONE,
  resolveBriefingDateTime,
} from '@/lib/procurement/dates'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export type BriefingPeriodSlug = 'today' | 'this-week' | 'next-week' | 'this-month'

export interface SastInstantRange {
  start: Date
  end: Date
}

const SAST_OFFSET = '+02:00'

const WEEKDAY_MON_ZERO: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

export function formatSastYmd(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PROCUREMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref)
}

export function sastWeekdayMondayZero(ref: Date = new Date()): number {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: PROCUREMENT_TIMEZONE,
    weekday: 'short',
  }).format(ref)
  return WEEKDAY_MON_ZERO[label] ?? 0
}

export function startOfSastDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${SAST_OFFSET}`)
}

export function endOfSastDay(ymd: string): Date {
  return new Date(`${ymd}T23:59:59${SAST_OFFSET}`)
}

/** Add calendar days in SAST (ymd strings). */
export function addSastDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0))
  return formatSastYmd(utc)
}

export function monthBoundsSast(ref: Date = new Date()): SastInstantRange {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROCUREMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(ref)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const startYmd = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const endYmd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start: startOfSastDay(startYmd), end: endOfSastDay(endYmd) }
}

export function weekBoundsSast(ref: Date = new Date(), offsetWeeks = 0): SastInstantRange {
  const today = formatSastYmd(ref)
  const daysFromMonday = sastWeekdayMondayZero(ref)
  const currentMonday = addSastDays(today, -daysFromMonday)
  const weekStart = addSastDays(currentMonday, offsetWeeks * 7)
  const weekEnd = addSastDays(weekStart, 6)
  return { start: startOfSastDay(weekStart), end: endOfSastDay(weekEnd) }
}

export function getBriefingPeriodRange(
  period: BriefingPeriodSlug,
  ref: Date = new Date()
): SastInstantRange {
  const today = formatSastYmd(ref)
  switch (period) {
    case 'today':
      return { start: startOfSastDay(today), end: endOfSastDay(today) }
    case 'this-week':
      return weekBoundsSast(ref, 0)
    case 'next-week':
      return weekBoundsSast(ref, 1)
    case 'this-month':
      return monthBoundsSast(ref)
    default:
      return { start: startOfSastDay(today), end: endOfSastDay(today) }
  }
}

export function briefingInstantInRange(
  tender: Pick<TenderBriefing, 'briefingDate' | 'briefingTime'>,
  range: SastInstantRange
): boolean {
  const instant = resolveBriefingDateTime(tender.briefingDate, tender.briefingTime)
  if (!instant) return false
  return instant >= range.start && instant <= range.end
}

export const BRIEFING_PERIOD_SLUGS: BriefingPeriodSlug[] = [
  'today',
  'this-week',
  'next-week',
  'this-month',
]

export function isBriefingPeriodSlug(value: string): value is BriefingPeriodSlug {
  return (BRIEFING_PERIOD_SLUGS as string[]).includes(value)
}

export const BRIEFING_PERIOD_LABELS: Record<BriefingPeriodSlug, string> = {
  today: 'Today',
  'this-week': 'This Week',
  'next-week': 'Next Week',
  'this-month': 'This Month',
}
