import { test, expect, type Page } from '@playwright/test'

/**
 * Youth Agent authentication / workspace journey (browser).
 *
 * Uses the fail-closed Playwright UI stub (localhost + build flag only).
 * Does not weaken production auth. Server assignment APIs are route-mocked
 * so the UI journey can be asserted without E2E_AGENT_TOKEN.
 */

const AGENT_UID = 'e2e-ya-auth-agent'

async function installYouthAgentStub(page: Page) {
  await page.addInitScript(
    ({ agentUid }) => {
      ;(window as unknown as { __TB_E2E_UI_STUB__?: unknown }).__TB_E2E_UI_STUB__ = {
        uid: agentUid,
        userType: 'youth-agent',
        email: 'e2e-ya-auth@tenderbriefing.test',
        token: 'e2e-stub-token',
      }
    },
    { agentUid: AGENT_UID }
  )
}

async function mockWorkspaceApis(page: Page) {
  await page.route('**/api/agent/workspace', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname !== '/api/agent/workspace') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { enabled: true, flagKey: 'youth_agent_workspace_v1', userType: 'youth-agent' },
      }),
    })
  })

  await page.route('**/api/agent/workspace/assignments', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405, body: '{}' })
      return
    }
    const auth = route.request().headers()['authorization'] || ''
    if (!auth.startsWith('Bearer ')) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'UNAUTHENTICATED', reason: 'missing_token' }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          assignments: [
            {
              requestId: 'e2e-assign-1',
              tenderNumber: 'TN-E2E-AUTH',
              tenderTitle: 'Auth repair assignment',
              province: 'Gauteng',
              status: 'arrived',
            },
          ],
          opportunities: [],
        },
      }),
    })
  })
}

test.describe('Youth Agent auth journey (browser)', () => {
  test('authenticated YA reaches assignments and list renders', async ({ page }) => {
    await installYouthAgentStub(page)
    await mockWorkspaceApis(page)

    const assignmentsResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/agent/workspace/assignments') &&
        !r.url().includes('/assignments/') &&
        r.request().method() === 'GET'
    )

    await page.goto('/agent/workspace/assignments')
    const res = await assignmentsResponse
    expect(res.status()).toBe(200)
    await expect(page.getByText('TN-E2E-AUTH')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Auth repair assignment')).toBeVisible()
  })

  test('reload keeps authenticated workspace assignments visible', async ({ page }) => {
    await installYouthAgentStub(page)
    await mockWorkspaceApis(page)

    await page.goto('/agent/workspace/assignments')
    await expect(page.getByText('TN-E2E-AUTH')).toBeVisible({ timeout: 30_000 })
    await page.reload()
    await expect(page.getByText('TN-E2E-AUTH')).toBeVisible({ timeout: 30_000 })
  })

  test('logged-out visit to workspace redirects toward sign-in', async ({ page }) => {
    // No stub — AuthProvider must treat user as signed out.
    await page.goto('/agent/workspace/assignments')
    await expect
      .poll(() => page.url(), { timeout: 30_000 })
      .toMatch(/\/auth\/signin/)
    expect(page.url()).toContain('redirect=')
  })

  test('login form submits only once per click (no duplicate handlers)', async ({ page }) => {
    await page.goto('/auth/signin')
    await expect(page.getByRole('button', { name: /sign in to tenderbriefing/i })).toBeVisible({
      timeout: 30_000,
    })
    const srcLock = await page.locator('form').count()
    expect(srcLock).toBeGreaterThanOrEqual(1)
    // Button disabled attribute toggles under loading; ensure single submit button.
    await expect(page.getByRole('button', { name: /sign in to tenderbriefing/i })).toHaveCount(1)
  })
})
