import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Youth Agent submit-evidence page regression (static / source-level)', () => {
  const filePath = path.resolve(
    __dirname,
    '../../../app/agent/workspace/assignments/[requestId]/submit-evidence/page.tsx'
  )

  it('contains the simplified upload UI and fail-closed access checks (source guard)', () => {
    const src = fs.readFileSync(filePath, 'utf8')

    // Required UI copy.
    expect(src).toContain('Upload Briefing Recording')
    expect(src).toContain('Upload Attendance Proof')
    expect(src).toContain('Submit Report')

    // Fail-closed: only the assigned Youth Agent may open this page.
    expect(src).toContain('workspaceGet(`/api/agent/workspace/assignments/${requestId}`)')
    expect(src).toContain('/agent/workspace/assignments')
    expect(src).toContain('You are not authorised to submit this briefing report.')

    // Evidence submission is blocked when required inputs are missing.
    expect(src).toContain('Select audio first')
    expect(src).toContain('Select attendance evidence')

    // Simplification: the UI must not collect tender/audio notes or tender-context inputs.
    expect(src).not.toContain("formData.append('observations'")
    expect(src).not.toMatch(/tenderContext/i)
  })
})

