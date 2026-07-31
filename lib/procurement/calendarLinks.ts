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

function parseTime(time?: string | null): { hours: number; minutes: number } | null {
  if (!time) return null
  const cleaned = time.trim().toUpperCase()
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

function briefingDateTime(tender: CalendarExportInput): { start: Date; end: Date } | null {
  if (!tender.briefingDate) return null
  const base = new Date(tender.briefingDate)
  if (Number.isNaN(base.getTime())) return null
  const time = parseTime(tender.briefingTime)
  if (time) {
    base.setHours(time.hours, time.minutes, 0, 0)
  } else {
    base.setHours(10, 0, 0, 0)
  }
  const end = new Date(base)
  end.setHours(end.getHours() + 2)
  return { start: base, end }
}

function closingDateTime(tender: CalendarExportInput): { start: Date; end: Date } | null {
  if (!tender.closingDate) return null
  const base = new Date(tender.closingDate)
  if (Number.isNaN(base.getTime())) return null
  // All-day-ish window: noon local for visibility in calendars
  if (base.getHours() === 0 && base.getMinutes() === 0) {
    base.setHours(12, 0, 0, 0)
  }
  const end = new Date(base)
  end.setHours(end.getHours() + 1)
  return { start: base, end }
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
