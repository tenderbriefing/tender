import { describe, expect, it } from 'vitest'

describe('integration health posture', () => {
  it('marks Google Calendar as scaffold (not configured)', () => {
    const calendar = require('../../backend/services/integrations/calendarService.js')
    const status = calendar.getStatus()
    expect(status.id).toBe('google_calendar')
    expect(status.status).toBe('scaffold')
  })

  it('marks Meta WhatsApp as deferred; Twilio remains the live path', () => {
    const meta = require('../../backend/services/integrations/whatsappService.js')
    const status = meta.getStatus()
    expect(status.id).toBe('whatsapp-meta')
    expect(status.status).toBe('deferred')
  })
})
