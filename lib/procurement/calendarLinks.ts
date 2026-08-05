import { parseBriefingTimeParts, resolveBriefingDateTime } from './dates'

/** Minimal tender fields needed for Google / ICS export (full TenderBriefing also works). */
export type CalendarExportInput = {
  id?: string
  title?: string
  tenderNumber?: string
  department?: string
  detailUrl?: string
  briefingDate?: string | null
  briefingTime?: string | null
  briefingVenue?: string | null
  province?: string | null
  closingDate?: string | null
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatGoogleDate(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

/** Slot used when the feed gives a date but no usable clock. */
const DEFAULT_BRIEFING_TIME = '10:00'
const DEFAULT_CLOSING_TIME = '12:00'
const BRIEFING_DURATION_MS = 2 * 60 * 60 * 1000
const CLOSING_DURATION_MS = 60 * 60 * 1000

function briefingDateTime(tender: CalendarExportInput): { start: Date; end: Date } | null {
  const raw = tender.briefingDate?.trim()
  if (!raw) return null

  const hasOwnClock =
    parseBriefingTimeParts(tender.briefingTime) !== null || /T\d{2}:\d{2}/.test(raw)
  const start = resolveBriefingDateTime(
    raw,
    hasOwnClock ? tender.briefingTime : DEFAULT_BRIEFING_TIME
  )
  if (!start) return null

  return { start, end: new Date(start.getTime() + BRIEFING_DURATION_MS) }
}

function closingDateTime(tender: CalendarExportInput): { start: Date; end: Date } | null {
  const raw = tender.closingDate?.trim()
  if (!raw) return null

  // A midnight or absent clock means the feed only gave a date; use a midday slot so
  // the reminder stays visible instead of collapsing to the start of the day.
  const clock = raw.match(/T(\d{2}):(\d{2})/)
  const dateOnly = !clock || (clock[1] === '00' && clock[2] === '00')
  const start = resolveBriefingDateTime(raw, dateOnly ? DEFAULT_CLOSING_TIME : null)
  if (!start) return null

  return { start, end: new Date(start.getTime() + CLOSING_DURATION_MS) }
}

export function toCalendarExportInput(tender: CalendarExportInput): CalendarExportInput {
  return {
    id: tender.id,
    title: tender.title,
    tenderNumber: tender.tenderNumber,
    department: tender.department,
    detailUrl: tender.detailUrl,
    briefingDate: tender.briefingDate,
    briefingTime: tender.briefingTime,
    briefingVenue: tender.briefingVenue,
    province: tender.province,
    closingDate: tender.closingDate,
  }
}

export function buildGoogleCalendarUrl(
  tender: CalendarExportInput,
  eventType: 'briefing' | 'closing' = 'briefing'
): string | null {
  const range =
    eventType === 'closing' ? closingDateTime(tender) : briefingDateTime(tender)
  if (!range) return null
  const label = eventType === 'closing' ? 'Closing' : 'Briefing'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${label} — ${tender.title || tender.tenderNumber || 'Tender briefing'}`,
    dates: `${formatGoogleDate(range.start)}/${formatGoogleDate(range.end)}`,
    details: [
      tender.department,
      tender.tenderNumber ? `Tender: ${tender.tenderNumber}` : '',
      tender.detailUrl ? `Source: ${tender.detailUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location:
      eventType === 'closing'
        ? tender.province || ''
        : tender.briefingVenue || tender.province || '',
  })
  return `https://www.google.com/calendar/render?${params.toString()}`
}

export function buildIcsContent(
  tender: CalendarExportInput,
  eventType: 'briefing' | 'closing' = 'briefing'
): string | null {
  const range =
    eventType === 'closing' ? closingDateTime(tender) : briefingDateTime(tender)
  if (!range) return null
  const label = eventType === 'closing' ? 'Closing' : 'Briefing'
  const uid = `${tender.id || tender.tenderNumber || 'tender'}-${eventType}@tenderbriefing.co.za`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TenderBriefing//Briefing//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatGoogleDate(new Date())}`,
    `DTSTART:${formatGoogleDate(range.start)}`,
    `DTEND:${formatGoogleDate(range.end)}`,
    `SUMMARY:${label} — ${tender.title || tender.tenderNumber || 'Tender briefing'}`,
    `LOCATION:${
      eventType === 'closing'
        ? tender.province || ''
        : tender.briefingVenue || tender.province || ''
    }`,
    `DESCRIPTION:${tender.department || ''}${tender.detailUrl ? ` — ${tender.detailUrl}` : ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcsFile(
  tender: CalendarExportInput,
  eventType: 'briefing' | 'closing' = 'briefing'
): boolean {
  const ics = buildIcsContent(tender, eventType)
  if (!ics) return false
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tender.tenderNumber || tender.id || 'tender'}-${eventType}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
