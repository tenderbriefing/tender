import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

/**
 * Local macOS often has Google Chrome installed while Playwright's pinned
 * Chromium download can be interrupted. Prefer channel=chrome locally when present.
 * CI continues to use the Playwright-managed Chromium from `npx playwright install chromium`.
 */
function chromeChannel(): 'chrome' | undefined {
  if (process.env.PLAYWRIGHT_CHROME_CHANNEL === '0') return undefined
  if (process.env.PLAYWRIGHT_CHROME_CHANNEL === 'chrome') return 'chrome'
  if (process.env.CI) return undefined
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (fs.existsSync(macChrome)) return 'chrome'
  return undefined
}

const channel = chromeChannel()

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...(channel ? { channel } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        // Mirror Dockerfile: standalone needs .next/static beside server.js
        command:
          'mkdir -p .next/standalone/.next && cp -R .next/static .next/standalone/.next/static && (test -d public && mkdir -p .next/standalone/public && cp -R public/. .next/standalone/public/ || true) && PORT=3000 HOSTNAME=127.0.0.1 node .next/standalone/server.js',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
