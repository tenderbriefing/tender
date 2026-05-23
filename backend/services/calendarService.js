function toIsoDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function buildCalendarEvents(tender) {
  const events = []

  if (tender.briefingDate) {
    events.push({
      id: `${tender.id}-briefing`,
      type: 'briefing',
      title: `Briefing: ${tender.title}`,
      start: toIsoDate(tender.briefingDate),
      end: toIsoDate(tender.briefingDate),
      time: tender.briefingTime || '',
      location: tender.briefingVenue || tender.province || '',
      compulsory: !!tender.briefingCompulsory,
      tenderId: tender.id,
      ocid: tender.ocid,
      exportReady: true,
      providers: {
        googleCalendar: 'future',
        outlook: 'future',
        ics: 'future',
      },
    })
  }

  if (tender.closingDate) {
    events.push({
      id: `${tender.id}-closing`,
      type: 'closing',
      title: `Closing: ${tender.title}`,
      start: toIsoDate(tender.closingDate),
      end: toIsoDate(tender.closingDate),
      location: tender.province || '',
      compulsory: false,
      tenderId: tender.id,
      ocid: tender.ocid,
      exportReady: true,
      providers: {
        googleCalendar: 'future',
        outlook: 'future',
        ics: 'future',
      },
    })
  }

  return {
    ...tender,
    calendarEvents: events,
  }
}

function getAllCalendarEvents(tenders) {
  return tenders.flatMap((t) => t.calendarEvents || [])
}

function generateIcsEvent(event) {
  const uid = event.id
  const dt = (event.start || '').replace(/[-:]/g, '').split('.')[0]
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@tenderbriefing`,
    `DTSTART:${dt}`,
    `SUMMARY:${(event.title || '').replace(/\n/g, ' ')}`,
    `LOCATION:${(event.location || '').replace(/\n/g, ' ')}`,
    'END:VEVENT',
  ].join('\r\n')
}

module.exports = {
  buildCalendarEvents,
  getAllCalendarEvents,
  generateIcsEvent,
}
