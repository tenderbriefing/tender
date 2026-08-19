import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

function unboundedGet(source: string, collection: string) {
  const re = new RegExp(
    String.raw`(?:db|getFirestore\(\))\.collection\(\s*['"]${collection}['"]\s*\)\s*\.get\(\)`
  )
  return re.test(source)
}

describe('hot-path Firestore safeguards', () => {
  it('command center does not load an unrestricted tender dataset', () => {
    const s = src('backend/services/commandCenterService.js')
    expect(s).not.toMatch(/getAllTenders\s*\(/)
    expect(s).not.toMatch(/getTenderBriefings\s*\(/)
    expect(s).toMatch(/getAttendanceRequests\(\{\s*limit:\s*500/)
    expect(s).toMatch(/\.limit\(300\)/)
  })

  it('admin stats summary uses aggregates, not catalogue scans', () => {
    const s = src('lib/seo/publicStats.ts')
    expect(s).not.toMatch(/getTenderBriefings\s*\(/)
    expect(s).not.toMatch(/getAllTenders\s*\(/)
    expect(s).toMatch(/countDocuments/)
    expect(s).toMatch(/readCatalogueSummary/)
  })

  it('operational intelligence reuses stats and bounds request reads', () => {
    const s = src('app/api/operational/intelligence/route.ts')
    expect(s).toMatch(/buildPublicProcurementStats/)
    expect(s).not.toMatch(/getAllTenders/)
    expect(s).not.toMatch(/getTenderBriefings/)
    expect(s).toMatch(/getAttendanceRequests\(\{\s*limit:\s*800/)
    expect(s).toMatch(/pendingAttendanceRequests:\s*stats\.pendingBriefings/)
  })

  it('founder intelligence uses count aggregations and query limits', () => {
    const s = src('backend/services/founderIntelligenceService.js')
    expect(s).toMatch(/\.count\(\)\.get\(\)/)
    expect(s).toMatch(/attendanceRequests'\)\.limit\(1500\)/)
    expect(unboundedGet(s, 'attendanceRequests')).toBe(false)
    expect(unboundedGet(s, 'users')).toBe(false)
    expect(s).toMatch(/userType === 'sme'/)
    expect(s).toMatch(/youth-agent/)
  })

  it('catalogue API requires hotPathLog from repo root, not a parent directory', () => {
    const s = src('app/api/tender-briefings/route.ts')
    expect(s).toMatch(/require\('\.\.\/\.\.\/\.\.\/backend\/services\/hotPathLog'\)/)
    expect(s).not.toMatch(/require\('\.\.\/\.\.\/\.\.\/\.\.\/backend\/services\/hotPathLog'\)/)
    expect(s).toMatch(/Promise\.all/)
    expect(s).toMatch(/listTenderBriefingsPage/)
    expect(s).toMatch(/loadCatalogueMeta/)
  })

  it('attendance request by id is a document get, not a collection scan', () => {
    const firestore = src('backend/services/firestoreStorageService.js')
    const assignment = src('backend/services/agentAssignmentService.js')
    const payment = src('backend/services/payments/attendancePaymentService.js')
    expect(firestore).toMatch(/async function getAttendanceRequestById/)
    expect(firestore).toMatch(/\.collection\(COLLECTIONS\.ATTENDANCE_REQUESTS\)\.doc\(String\(id\)\)\.get\(\)/)
    const assignmentLookup = assignment.slice(
      assignment.indexOf('async function getRequestById'),
      assignment.indexOf('async function createRequest')
    )
    expect(assignmentLookup).toMatch(/getAttendanceRequestById/)
    expect(assignmentLookup).not.toMatch(/getAttendanceRequests\(/)
    const paymentLookup = payment.slice(
      payment.indexOf('async function getRequestById'),
      payment.indexOf('async function saveRequest')
    )
    expect(paymentLookup).toMatch(/getAttendanceRequestById/)
    expect(paymentLookup).not.toMatch(/getAttendanceRequests\(/)
  })

  it('getSyncStatus does not load all tenders', () => {
    const s = src('backend/services/incrementalSyncService.js')
    const start = s.indexOf('async function getSyncStatus')
    const body = s.slice(start, s.indexOf('module.exports', start))
    expect(body).not.toMatch(/getTenderBriefings\s*\(/)
    expect(body).not.toMatch(/getAllTenders\s*\(/)
    expect(body).toMatch(/readCatalogueSummary/)
  })
})
