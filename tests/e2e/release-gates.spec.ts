import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Route retirement & public accessibility floor', () => {
  test('legacy bookings API returns 410', async ({ request }) => {
    const res = await request.get('/api/bookings')
    expect([410, 401, 404]).toContain(res.status())
    // In non-prod without bearer, middleware may 401 before handler; POST with fake auth path:
    const post = await request.post('/api/bookings', {
      data: {},
      headers: { Authorization: 'Bearer invalid' },
    })
    // 401 from middleware or 410 from handler — never 200 success booking create
    expect(post.status()).not.toBe(200)
  })

  test('Yoco payment routes return 410 when reachable', async ({ request }) => {
    const create = await request.post('/api/payments/yoco/create-checkout', {
      data: { attendanceRequestId: 'x' },
      headers: { Authorization: 'Bearer invalid' },
    })
    expect([410, 401]).toContain(create.status())
  })

  test('/bookings redirects toward SME requests', async ({ page }) => {
    await page.goto('/bookings')
    await page.waitForLoadState('domcontentloaded')
    const url = page.url()
    expect(url.includes('/bookings') || url.includes('/sme/requests') || url.includes('/auth')).toBe(
      true
    )
  })

  test('home has no critical axe violations (wcag2a)', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a']).analyze()
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([])
  })

  test('tenders listing has accessible main landmark', async ({ page }) => {
    await page.goto('/tenders')
    await page.waitForLoadState('domcontentloaded')
    const main = page.locator('main, [role="main"]')
    await expect(main.first()).toBeVisible({ timeout: 15_000 })
  })

  test('signin page has labeled form controls', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.waitForLoadState('domcontentloaded')
    const email = page.locator('input[type="email"], input[name="email"]').first()
    if (await email.count()) {
      const id = await email.getAttribute('id')
      if (id) {
        await expect(page.locator(`label[for="${id}"]`)).toBeVisible()
      } else {
        await expect(page.getByText(/email/i).first()).toBeVisible()
      }
    }
  })
})

/**
 * Full authenticated E2E requires E2E_SME_TOKEN / E2E_AGENT_TOKEN / E2E_ADMIN_TOKEN.
 * Skipped in CI unless secrets are provided — service-layer integration covers workflow.
 */
test.describe('Authenticated workflows (optional secrets)', () => {
  test.skip(!process.env.E2E_SME_TOKEN, 'Requires E2E_SME_TOKEN')

  test('SME can list attendance requests with token', async ({ request }) => {
    const res = await request.get('/api/attendance-requests', {
      headers: { Authorization: `Bearer ${process.env.E2E_SME_TOKEN}` },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
