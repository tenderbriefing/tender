import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Chrome enforces CSP form-action across PayFast's redirect chain:
 * POST www.payfast.co.za/eng/process → 302 payment.payfast.io/...
 * Removing either host breaks live R249 checkout in Chromium.
 */
describe('PayFast CSP allowlist (production checkout)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'next.config.js'), 'utf8')
  const formActionLine =
    src
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('"form-action ')) || ''

  it('form-action allows www.payfast.co.za (checkout POST target)', () => {
    expect(formActionLine).toContain('https://www.payfast.co.za')
  })

  it('form-action allows sandbox.payfast.co.za (sandbox checkout)', () => {
    expect(formActionLine).toContain('https://sandbox.payfast.co.za')
  })

  it('form-action allows payment.payfast.io (live redirect hop)', () => {
    expect(formActionLine).toContain('https://payment.payfast.io')
  })

  it('does not rely on a broad *.payfast.io form-action wildcard', () => {
    expect(formActionLine).not.toMatch(/\*\.payfast\.io/)
  })

  it('preserves self in form-action', () => {
    expect(formActionLine).toMatch(/form-action 'self'/)
  })
})
