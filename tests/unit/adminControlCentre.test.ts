import { describe, expect, it } from 'vitest'
import {
  ADMIN_CONTROL_CENTRE_MODULES,
  ADMIN_HEADER_NAV,
  CONTROL_CENTRE_PRIMARY_ACTIONS,
  CONTROL_CENTRE_TABS,
  FOUNDER_HEADER_NAV,
  filterAdminModules,
  getAdminHeaderNav,
  getClientFeatureFlagSnapshot,
} from '@/lib/admin/controlCentre'

describe('admin control centre IA', () => {
  it('exposes primary actions for RFQ, assignments, disputes, and payments', () => {
    const hrefs = CONTROL_CENTRE_PRIMARY_ACTIONS.map((a) => a.href)
    expect(hrefs).toContain('/admin/procurement-inbox')
    expect(hrefs).toContain('/admin/operations')
    expect(hrefs).toContain('/admin/fraud')
    expect(hrefs).toContain('/admin/integrations')
  })

  it('keeps secondary content behind four tabs', () => {
    expect(CONTROL_CENTRE_TABS.map((t) => t.id)).toEqual([
      'overview',
      'people',
      'system',
      'modules',
    ])
  })

  it('hides founder-only modules for non-founders', () => {
    const admin = filterAdminModules({ showFounder: false })
    const operate = admin.find((g) => g.id === 'operate')
    expect(operate?.links.some((l) => l.href === '/founder')).toBe(false)

    const founder = filterAdminModules({ showFounder: true })
    const founderOperate = founder.find((g) => g.id === 'operate')
    expect(founderOperate?.links.some((l) => l.href === '/founder')).toBe(true)
  })

  it('preserves critical operational destinations in the module catalogue', () => {
    const hrefs = ADMIN_CONTROL_CENTRE_MODULES.flatMap((g) => g.links.map((l) => l.href))
    for (const required of [
      '/admin/registrations',
      '/admin/operations',
      '/admin/procurement-inbox',
      '/admin/dispatch',
      '/admin/agents/performance',
      '/admin/agent-workspace',
      '/admin/finance',
      '/admin/integrations',
      '/admin/fraud',
      '/admin/scraping',
      '/admin/pilot',
    ]) {
      expect(hrefs).toContain(required)
    }
  })

  it('keeps header nav lean and aligned with the operations console', () => {
    expect(ADMIN_HEADER_NAV[0]).toEqual({
      name: 'Console',
      href: '/admin/dashboard',
    })
    expect(ADMIN_HEADER_NAV.length).toBeLessThanOrEqual(8)
  })

  it('puts Founder first in founder header nav', () => {
    expect(FOUNDER_HEADER_NAV[0]).toEqual({ name: 'Founder', href: '/founder' })
    expect(FOUNDER_HEADER_NAV.some((l) => l.href === '/admin/dashboard')).toBe(true)
    expect(getAdminHeaderNav({ showFounder: true })[0].href).toBe('/founder')
    expect(getAdminHeaderNav({ showFounder: false })[0].href).toBe('/admin/dashboard')
    expect(getAdminHeaderNav({ showFounder: true }).length).toBeLessThanOrEqual(8)
  })

  it('returns read-only feature flag rows without throwing', () => {
    const flags = getClientFeatureFlagSnapshot()
    expect(flags.length).toBeGreaterThanOrEqual(3)
    expect(flags.every((f) => typeof f.enabled === 'boolean')).toBe(true)
  })
})
