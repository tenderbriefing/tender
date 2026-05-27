import type { TenderBriefing } from '@/lib/tenderBriefing/types'

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

function briefingDateTime(tender: TenderBriefing): { start: Date; end: Date } | null {
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

export function buildGoogleCalendarUrl(tender: TenderBriefing): string | null {
  const range = briefingDateTime(tender)
  if (!range) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Briefing — ${tender.title || tender.tenderNumber || 'Tender briefing'}`,
    dates: `${formatGoogleDate(range.start)}/${formatGoogleDate(range.end)}`,
    details: [
      tender.department,
      tender.tenderNumber ? `Tender: ${tender.tenderNumber}` : '',
      tender.detailUrl ? `Source: ${tender.detailUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location: tender.briefingVenue || tender.province || '',
  })
  return `https://www.google.com/calendar/render?${params.toString()}`
}

export function buildIcsContent(tender: TenderBriefing): string | null {
  const range = briefingDateTime(tender)
  if (!range) return null
  const uid = `${tender.id || tender.tenderNumber || 'tender'}@tenderbriefing.co.za`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TenderBriefing//Briefing//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatGoogleDate(new Date())}`,
    `DTSTART:${formatGoogleDate(range.start)}`,
    `DTEND:${formatGoogleDate(range.end)}`,
    `SUMMARY:Briefing — ${tender.title || tender.tenderNumber || 'Tender briefing'}`,
    `LOCATION:${tender.briefingVenue || tender.province || ''}`,
    `DESCRIPTION:${tender.department || ''}${tender.detailUrl ? ` — ${tender.detailUrl}` : ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
