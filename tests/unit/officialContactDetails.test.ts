import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  OFFICE_ADDRESS_LINES,
  OFFICE_EMAIL,
  OFFICE_EMAIL_HREF,
  OFFICE_PHONE_DISPLAY,
  OFFICE_PHONE_HREF,
  OFFICE_STREET_ADDRESS,
  SUPPORT_EMAIL,
} from '@/lib/contact'

describe('canonical office contact', () => {
  it('exposes official Centurion address, phone, and info email', () => {
    expect(OFFICE_PHONE_DISPLAY).toBe('+27 12 004 8728')
    expect(OFFICE_PHONE_HREF).toBe('tel:+27120048728')
    expect(OFFICE_EMAIL).toBe('info@tenderbriefing.co.za')
    expect(OFFICE_EMAIL_HREF).toBe('mailto:info@tenderbriefing.co.za')
    expect(OFFICE_ADDRESS_LINES).toEqual([
      'Byls Bridge Office Park',
      'First Floor, Block B',
      'Olievenhoutbosch Road',
      'Doringkloof',
      'Centurion, 0157',
      'South Africa',
    ])
    expect(OFFICE_STREET_ADDRESS).toContain('Byls Bridge Office Park')
    expect(OFFICE_STREET_ADDRESS).toContain('Olievenhoutbosch Road')
    expect(SUPPORT_EMAIL).toBe('support@tenderbriefing.co.za')
  })

  it('footer and contact page consume canonical links and address', () => {
    const footer = fs.readFileSync(
      path.join(process.cwd(), 'components/layout/Footer.tsx'),
      'utf8'
    )
    const contact = fs.readFileSync(
      path.join(process.cwd(), 'app/contact/page.tsx'),
      'utf8'
    )

    for (const src of [footer, contact]) {
      expect(src).toContain('OFFICE_PHONE_HREF')
      expect(src).toContain('OFFICE_EMAIL_HREF')
      expect(src).toContain('OFFICE_ADDRESS_LINES')
      expect(src).not.toContain('Midrand')
    }

    expect(footer).toContain('from \'@/lib/contact\'')
    expect(contact).toContain('ContactForm')
  })
})
