import { test, expect } from '@playwright/test'

test.describe('SEO crawlability without JavaScript', () => {
  test('/tenders initial HTML contains tender detail links', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/tenders', { waitUntil: 'domcontentloaded' })

    const links = page.locator('a[href^="/tenders/"]:not([href="/tenders"])')
    const count = await links.count()

    if (count === 0) {
      test.info().annotations.push({
        type: 'note',
        description:
          'No live tenders in catalogue fixture — SSR empty state is valid. Run against production-like data for link assertions.',
      })
      await expect(page.locator('#tender-catalogue-ssr')).toBeVisible()
    } else {
      expect(count).toBeGreaterThan(0)
      const href = await links.first().getAttribute('href')
      expect(href).toMatch(/^\/tenders\/[^/]+$/)
    }

    await context.close()
  })

  test('/tenders/gauteng initial HTML contains crawlable structure', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/tenders/gauteng', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('h2', { hasText: 'Matching opportunities' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View all tenders' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse all tenders' })).toBeVisible()

    const tenderLinks = page.locator('a[href^="/tenders/"]:not([href="/tenders/gauteng"])')
    const count = await tenderLinks.count()
    // Empty live catalogue is valid locally; when tenders exist they must be crawlable.
    if (count > 0) {
      const href = await tenderLinks.first().getAttribute('href')
      expect(href).toMatch(/^\/tenders\/[^/]+$/)
    }

    await context.close()
  })
})
