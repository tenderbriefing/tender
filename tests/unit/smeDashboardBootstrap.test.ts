import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('SME dashboard bootstrap', () => {
  it('exposes GET /api/sme/dashboard/bootstrap with SME-only auth', () => {
    const route = src('app/api/sme/dashboard/bootstrap/route.ts')
    expect(route).toMatch(/loadSmeDashboardBootstrap/)
    expect(route).toMatch(/userType !== 'sme'/)
    expect(route).toMatch(/verifyApiUser/)
  })

  it('loader fetches attendance once and uses bounded report reads', () => {
    const loader = src('lib/sme/loadSmeDashboardBootstrap.ts')
    expect(loader).toMatch(/getAttendanceRequests\(\{\s*smeId:\s*uid,\s*limit:\s*ATTENDANCE_LIMIT/)
    expect(loader).toMatch(/requestIds:\s*requestIds\.slice\(0,\s*30\)/)
    expect(loader).toMatch(/Promise\.all\(/)
    expect(loader).not.toMatch(/getTenderBriefings\s*\(/)
    expect(loader).not.toMatch(/getAttendanceRequests\(\s*\)/)
  })

  it('SME dashboard page uses bootstrap hook instead of three initial dashboard fetches', () => {
    const page = src('app/sme/dashboard/page.tsx')
    expect(page).toMatch(/useSmeDashboardBootstrap/)
    expect(page).not.toMatch(/useDashboardMetrics\(\s*Boolean\(user\)\s*\)/)
    expect(page).toMatch(/skipFetch=\{useBootstrapFeed\}/)
    expect(page).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/dashboard\/CalendarIntegration'\)/)
  })

  it('bootstrap response includes metrics, workspace, and recentActivities', () => {
    const types = src('lib/sme/dashboardBootstrapTypes.ts')
    expect(types).toMatch(/metrics:\s*SmeDashboardMetrics/)
    expect(types).toMatch(/workspace:/)
    expect(types).toMatch(/recentActivities:/)
  })

  it('procurement workspace accepts preloaded bootstrap data', () => {
    const comp = src('components/sme/SmeProcurementWorkspace.tsx')
    expect(comp).toMatch(/initialData\?:/)
    expect(comp).toMatch(/skipFetch\?:/)
  })

  it('recent activity accepts preloaded bootstrap data', () => {
    const comp = src('components/dashboard/RecentActivity.tsx')
    expect(comp).toMatch(/initialActivities\?:/)
    expect(comp).toMatch(/skipFetch\?:/)
  })
})

describe('SME dashboard bootstrap request budget (before vs after)', () => {
  it('documents eliminated initial dashboard API calls on SME dashboard', () => {
    const beforeCalls = ['/api/dashboard/metrics', '/api/sme/workspace', '/api/dashboard/activities']
    const afterPrimary = ['/api/sme/dashboard/bootstrap']
    const deferred = ['/api/calendar/events']

    expect(beforeCalls.length).toBe(3)
    expect(afterPrimary.length).toBe(1)
    expect(deferred.length).toBe(1)
    expect(beforeCalls.length - afterPrimary.length).toBe(2)
  })
})
