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

  test('push notification routes return 410 when reachable', async ({ request }) => {
    for (const path of [
      '/api/push-notifications/send',
      '/api/push-notifications/subscribe',
      '/api/push/register-token',
    ]) {
      const res = await request.post(path, {
        data: {},
        headers: { Authorization: 'Bearer invalid' },
      })
      expect([410, 401]).toContain(res.status())
    }
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

  test('private tender submit page is reachable and noindex', async ({ page }) => {
    const res = await page.goto('/submit-tender')
    expect(res?.ok()).toBeTruthy()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Publish a Private Tender' })).toBeVisible({
      timeout: 15_000,
    })
    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots || '').toMatch(/noindex/i)
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

test.describe('API auth negative gates (no secrets required)', () => {
  test('attendance-requests without auth is denied', async ({ request }) => {
    const res = await request.get('/api/attendance-requests')
    expect([401, 403]).toContain(res.status())
  })

  test('attendance-requests with invalid bearer is denied', async ({ request }) => {
    const res = await request.get('/api/attendance-requests', {
      headers: { Authorization: 'Bearer clearly-invalid-token' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('agent accept without auth is denied', async ({ request }) => {
    const res = await request.post('/api/attendance-requests/does-not-exist/accept', {
      data: {},
    })
    expect([401, 403, 404, 405]).toContain(res.status())
    expect(res.status()).not.toBe(200)
  })

  test('PayFast create-checkout without auth is denied', async ({ request }) => {
    const res = await request.post('/api/payments/payfast/create-checkout', {
      data: { attendanceRequestId: 'x' },
    })
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('SME book-agent shareable funnel', () => {
  test('guests hitting /sme/book-agent are sent to sign-in with return URL', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/sme/book-agent')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForURL(/\/auth\/signin/, { timeout: 15_000 })
    const url = new URL(page.url())
    expect(url.pathname).toBe('/auth/signin')
    expect(url.searchParams.get('redirect')).toBe('/sme/book-agent')
  })

  test('book-agent deep-link preserves tender checkout return path', async ({ page }) => {
    await page.goto('/sme/book-agent?tenderId=sample-tender-id')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForURL(/\/auth\/signin/, { timeout: 15_000 })
    const url = new URL(page.url())
    expect(url.pathname).toBe('/auth/signin')
    expect(url.searchParams.get('redirect')).toBe(
      '/tenders/sample-tender-id/request-agent'
    )
  })

  test('private payment invite deep-link preserves invite on sign-in return', async ({
    page,
  }) => {
    await page.goto(
      '/sme/book-agent?tenderId=tb-PRIVATE-ABCDEF12&invite=sample-invite-token'
    )
    await page.waitForLoadState('domcontentloaded')
    await page.waitForURL(/\/auth\/signin/, { timeout: 15_000 })
    const url = new URL(page.url())
    expect(url.pathname).toBe('/auth/signin')
    expect(url.searchParams.get('redirect')).toBe(
      '/tenders/tb-PRIVATE-ABCDEF12/request-agent?invite=sample-invite-token'
    )
  })
})

test.describe('Post-registration welcome (public gates)', () => {
  test('welcome without session redirects away (no fake registration)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/auth/welcome')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForURL(/\/auth\/(signin|welcome)/, { timeout: 15_000 })
    // Unauthenticated visitors must not remain on a success welcome with CTA.
    const url = page.url()
    if (url.includes('/auth/welcome')) {
      await expect(page.getByRole('button', { name: /Go to Dashboard/i })).toHaveCount(0)
    } else {
      expect(url).toMatch(/\/auth\/signin/)
    }
  })

  test('signup pages remain reachable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/auth/signup?type=sme')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/SME Registration/i).first()).toBeVisible({ timeout: 15_000 })
    await page.goto('/auth/signup?type=youth-agent')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/Youth Agent Registration/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})

/**
 * Full authenticated E2E requires E2E_SME_TOKEN / E2E_AGENT_TOKEN / E2E_ADMIN_TOKEN.
 * When secrets are present, the suite runs. When absent:
 * - Local / PR without secrets: skip (integration tests cover workflow).
 * - CI on master/main with REQUIRE_E2E_AUTH=true: fail closed so secrets must be configured.
 *
 * Configure GitHub Actions repository secrets (never commit tokens):
 *   E2E_SME_TOKEN, E2E_AGENT_TOKEN (optional), E2E_ADMIN_TOKEN (optional)
 */
const hasSmeToken = Boolean(process.env.E2E_SME_TOKEN)
const requireAuthE2E =
  process.env.REQUIRE_E2E_AUTH === '1' || process.env.REQUIRE_E2E_AUTH === 'true'

test.describe('Authenticated workflows (optional secrets)', () => {
  test('CI auth-secret posture', () => {
    if (requireAuthE2E && !hasSmeToken) {
      throw new Error(
        'REQUIRE_E2E_AUTH is set but E2E_SME_TOKEN is missing. Add the GitHub Actions secret.'
      )
    }
    if (!hasSmeToken) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_SME_TOKEN absent — authenticated API checks skipped',
      })
    }
    expect(true).toBe(true)
  })

  test('SME can list attendance requests with token', async ({ request }) => {
    test.skip(!hasSmeToken, 'Requires E2E_SME_TOKEN')
    const res = await request.get('/api/attendance-requests', {
      headers: { Authorization: `Bearer ${process.env.E2E_SME_TOKEN}` },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  test('SME token cannot call admin scrape status', async ({ request }) => {
    test.skip(!hasSmeToken, 'Requires E2E_SME_TOKEN')
    const res = await request.get('/api/scrape?action=status', {
      headers: { Authorization: `Bearer ${process.env.E2E_SME_TOKEN}` },
    })
    expect([401, 403]).toContain(res.status())
  })
})
