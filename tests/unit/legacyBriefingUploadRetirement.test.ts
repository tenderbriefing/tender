import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  legacyBriefingUploadRedirect,
  youthAgentSubmitEvidencePath,
  youthAgentAssignmentsPath,
} from '@/lib/agent/workspace/paths'

describe('legacy briefing upload retirement', () => {
  it('maps requestId to submit-evidence and empty to assignments', () => {
    expect(legacyBriefingUploadRedirect('req-1787083805398-rcw6f0')).toBe(
      youthAgentSubmitEvidencePath('req-1787083805398-rcw6f0')
    )
    expect(legacyBriefingUploadRedirect('')).toBe(youthAgentAssignmentsPath())
    expect(legacyBriefingUploadRedirect(null)).toBe(youthAgentAssignmentsPath())
  })

  it('legacy upload page permanently redirects (no BriefingReportUploadForm)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../app/briefing-reports/upload/page.tsx'),
      'utf8'
    )
    expect(src).toContain('legacyBriefingUploadRedirect')
    expect(src).toContain('redirect(')
    expect(src).not.toContain('BriefingReportUploadForm')
  })

  it('primary Youth Agent entry points no longer deep-link the legacy form', () => {
    const files = [
      'components/dashboard/QuickActions.tsx',
      'components/dashboard/DashboardWelcome.tsx',
      'components/notifications/NotificationCenter.tsx',
      'app/jobs/page.tsx',
      'app/agent/mobile/briefing/[requestId]/page.tsx',
    ]
    for (const rel of files) {
      const src = fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8')
      expect(src, rel).not.toContain('/briefing-reports/upload')
      expect(src, rel).toMatch(/submit-evidence|\/agent\/workspace\/assignments/)
    }
  })
})
