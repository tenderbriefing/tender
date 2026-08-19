import { test, expect, type Page } from '@playwright/test'

const FOUNDER_EMAIL = 'info@tenderbriefing.co.za'
const RUN = process.env.FOUNDER_E2E === '1' && Boolean(process.env.SMOKE_TEST_PASSWORD)

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.skip(!RUN, 'Set FOUNDER_E2E=1 and SMOKE_TEST_PASSWORD to run signed-in founder smoke')

async function signInFounder(page: Page) {
  const password = process.env.SMOKE_TEST_PASSWORD || ''
  await page.goto('/auth/signin')
  await page.locator('#email').fill(FOUNDER_EMAIL)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /sign in to tenderbriefing/i }).click()
  await page.waitForURL(/\/founder(\/|$|\?)/, { timeout: 45_000 })
}

test.describe('Founder Dashboard V2 signed-in walkthrough', () => {
  test('Overview KPIs, periods, chart, Needs Attention', async ({ page }) => {
    await signInFounder(page)
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('SMEs', { exact: true })).toBeVisible()
    await expect(page.getByText('Youth Agents', { exact: true })).toBeVisible()
    await expect(page.getByText('Paid Bookings', { exact: true })).toBeVisible()
    await expect(page.getByText('Revenue', { exact: true })).toBeVisible()
    await expect(page.getByText('Upcoming Briefings', { exact: true })).toBeVisible()
    await expect(page.getByText('Completed Briefings', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '7 Days' })).toBeVisible()
    await expect(page.getByRole('button', { name: '30 Days' })).toBeVisible()
    await expect(page.getByRole('button', { name: '90 Days' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All Time' })).toBeVisible()
    await page.getByRole('button', { name: '7 Days' }).click()
    await page.getByRole('button', { name: '90 Days' }).click()
    await page.getByRole('button', { name: 'All Time' }).click()
    await page.getByRole('button', { name: '30 Days' }).click()
    await expect(page.getByRole('heading', { name: 'Business Activity' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Needs Attention' })).toBeVisible()
  })

  test('SME, Youth Agent, Briefings, Settings links', async ({ page }) => {
    await signInFounder(page)
    await page.getByRole('link', { name: 'SMEs' }).first().click()
    await expect(page).toHaveURL(/\/founder\/smes/)
    await expect(page.getByRole('heading', { name: 'SMEs' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Company')).toBeVisible()

    await page.getByRole('link', { name: 'Youth Agents' }).first().click()
    await expect(page).toHaveURL(/\/founder\/agents/)
    await expect(page.getByRole('heading', { name: 'Youth Agents' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Completed')).toBeVisible()

    await page.getByRole('link', { name: 'Briefings' }).first().click()
    await expect(page).toHaveURL(/\/founder\/briefings/)
    await expect(page.getByRole('heading', { name: 'Briefings' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Status')).toBeVisible()

    await page.goto('/founder/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('link', { name: 'User Intelligence' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Operations console' })).toBeVisible()
  })

  test('responsive Overview at 375 and 1280', async ({ page }) => {
    await signInFounder(page)
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/founder')
      await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText('Revenue', { exact: true })).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8
      )
      expect(overflow, `horizontal overflow at ${width}`).toBe(false)
    }
  })
})
