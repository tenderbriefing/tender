import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

/**
 * Real browser UI regression for Youth Agent submit-evidence.
 *
 * Auth: Playwright sets window.__TB_E2E_UI_STUB__ (client-only). Server auth is
 * unchanged — assignment + evidence APIs are route-mocked so the UI can be
 * exercised without Firebase ID tokens (E2E_AGENT_TOKEN not required).
 */

const REQUEST_ID = 'e2e-req-assigned-1'
const OTHER_REQUEST_ID = 'e2e-req-unassigned-1'
const AGENT_UID = 'e2e-agent-a'

async function installYouthAgentStub(page: Page, uid = AGENT_UID) {
  await page.addInitScript(
    ({ agentUid }) => {
      ;(window as any).__TB_E2E_UI_STUB__ = {
        uid: agentUid,
        userType: 'youth-agent',
        email: 'e2e-agent@tenderbriefing.test',
        token: 'e2e-stub-token',
      }
    },
    { agentUid: uid }
  )
}

/** WorkspaceGate probes this; does not weaken live assignment/evidence APIs. */
async function mockWorkspaceEnabled(page: Page) {
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
}

async function mockAssignedAssignment(page: Page, requestId: string) {
  await page.route('**/api/agent/workspace/assignments/**', async (route) => {
    const url = route.request().url()
    if (route.request().method() !== 'GET') {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Method not allowed in e2e stub' }),
      })
      return
    }
    if (!url.includes(`/assignments/${requestId}`)) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Not found' }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          request: {
            id: requestId,
            status: 'arrived',
            agentId: AGENT_UID,
            tenderId: 'tender-e2e-1',
            smeId: 'sme-e2e-1',
          },
          tender: { title: 'E2E Tender', tenderNumber: 'TN-E2E-1' },
          aiSummary: null,
          fieldReportDraft: null,
          messages: [],
          auditEvents: [],
          allowedTransitions: [],
        },
      }),
    })
  })
}

async function mockForbiddenAssignment(page: Page, requestId: string) {
  await page.route('**/api/agent/workspace/assignments/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Method not allowed in e2e stub' }),
      })
      return
    }
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Not found' }),
    })
  })
}

function writeTempFile(name: string, contents: Buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-e2e-'))
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, contents)
  return filePath
}

test.describe('Youth Agent submit-evidence UI (browser)', () => {
  test('assigned YA sees only audio + attendance uploads and Submit Report', async ({ page }) => {
    await installYouthAgentStub(page)
    await mockWorkspaceEnabled(page)
    await mockAssignedAssignment(page, REQUEST_ID)

    await page.goto(`/agent/workspace/assignments/${REQUEST_ID}/submit-evidence`)
    await expect(page.getByRole('heading', { name: 'Upload Briefing Recording' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('heading', { name: 'Upload Attendance Proof' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit Report' })).toBeVisible()

    // No tender / observations / notes wizard UI.
    await expect(page.getByText(/tender document/i)).toHaveCount(0)
    await expect(page.getByLabel(/tender id/i)).toHaveCount(0)
    await expect(page.getByLabel(/tender number/i)).toHaveCount(0)
    await expect(page.getByLabel(/tender title/i)).toHaveCount(0)
    await expect(page.locator('textarea')).toHaveCount(0)
    await expect(page.getByText(/structured observations/i)).toHaveCount(0)
    await expect(page.getByText(/manual amendment/i)).toHaveCount(0)
    await expect(page.getByText(/notes wizard/i)).toHaveCount(0)

    const fileInputs = page.locator('input[type="file"]')
    await expect(fileInputs).toHaveCount(2)
  })

  test('missing audio blocks submission (UI)', async ({ page }) => {
    await installYouthAgentStub(page)
    await mockWorkspaceEnabled(page)
    await mockAssignedAssignment(page, REQUEST_ID)

    await page.goto(`/agent/workspace/assignments/${REQUEST_ID}/submit-evidence`)
    await expect(page.getByRole('button', { name: 'Submit Report' })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: 'Submit Report' }).click()
    await expect(page.getByText('Select audio first')).toBeVisible({ timeout: 10_000 })
  })

  test('missing attendance proof blocks submission after audio selected (UI)', async ({
    page,
  }) => {
    await installYouthAgentStub(page)
    await mockWorkspaceEnabled(page)
    await mockAssignedAssignment(page, REQUEST_ID)

    await page.goto(`/agent/workspace/assignments/${REQUEST_ID}/submit-evidence`)
    await expect(page.getByRole('heading', { name: 'Upload Briefing Recording' })).toBeVisible({
      timeout: 30_000,
    })

    const audioPath = writeTempFile('briefing.mp3', Buffer.from([1, 2, 3, 4]))
    const audioInput = page.locator('input[type="file"][accept*="audio"]').first()
    await audioInput.setInputFiles(audioPath)
    await expect(page.getByText('Audio selected').first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Submit Report' }).click()
    await expect(page.getByText('Select attendance evidence')).toBeVisible({ timeout: 10_000 })
  })

  test('both missing still blocks (no tender fields to fill)', async ({ page }) => {
    await installYouthAgentStub(page)
    await mockWorkspaceEnabled(page)
    await mockAssignedAssignment(page, REQUEST_ID)

    await page.goto(`/agent/workspace/assignments/${REQUEST_ID}/submit-evidence`)
    await expect(page.getByRole('button', { name: 'Submit Report' })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: 'Submit Report' }).click()
    await expect(page.getByText('Select audio first')).toBeVisible({ timeout: 10_000 })
  })

  test('unassigned YA cannot use submission page', async ({ page }) => {
    await installYouthAgentStub(page)
    await mockWorkspaceEnabled(page)
    await mockForbiddenAssignment(page, OTHER_REQUEST_ID)

    await page.goto(`/agent/workspace/assignments/${OTHER_REQUEST_ID}/submit-evidence`)

    // Fail-closed: unauthorised copy and/or redirect away from submit form.
    await expect
      .poll(async () => {
        const url = page.url()
        const unauth = await page.getByText(/not authorised/i).count()
        const redirected =
          url.includes('/agent/workspace/assignments') && !url.includes('/submit-evidence')
        const noSubmitForm =
          (await page.getByRole('heading', { name: 'Upload Briefing Recording' }).count()) === 0
        return unauth > 0 || redirected || noSubmitForm
      }, { timeout: 30_000 })
      .toBe(true)

    await expect(page.getByRole('heading', { name: 'Upload Briefing Recording' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Submit Report' })).toHaveCount(0)
  })
})
