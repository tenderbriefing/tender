import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'
import type { VerifiedApiUser } from '@/lib/auth/verifyApiUser'
import {
  buildGoogleCalendarUrl,
  toCalendarExportInput,
  type CalendarExportInput,
} from '@/lib/procurement/calendarLinks'
import type { AttendanceRequest, TenderBriefing } from '@/lib/tenderBriefing/types'

export const dynamic = 'force-dynamic'

type BuiltCalendarEvent = {
  id?: string
  type?: string
  title?: string
  start?: string | null
  end?: string | null
  time?: string
  location?: string
  compulsory?: boolean
  tenderId?: string
  ocid?: string
  exportReady?: boolean
  providers?: Record<string, string>
}

type ScopedCalendarEvent = BuiltCalendarEvent & {
  href: string
  requestId?: string
  googleCalendarUrl?: string | null
  exportTender?: CalendarExportInput
  scopeSource?: 'saved' | 'tracked' | 'attendance' | 'assignment' | 'opportunity' | 'catalogue'
}

const ACTIVE_ATTENDANCE = new Set(['pending', 'assigned', 'accepted'])

function eventHref(userType: VerifiedApiUser['userType'], tenderId?: string): string {
  if (!tenderId) {
    return userType === 'youth-agent' ? '/jobs' : '/tenders'
  }
  if (userType === 'youth-agent') return '/jobs'
  return `/tenders/${tenderId}`
}

function buildEventsForTenders(
  tenders: TenderBriefing[],
  calendar: { buildCalendarEvents?: (tender: unknown) => unknown },
  userType: VerifiedApiUser['userType'],
  metaByTenderId?: Map<string, { requestId?: string; scopeSource?: ScopedCalendarEvent['scopeSource'] }>
): ScopedCalendarEvent[] {
  return tenders.flatMap((tender) => {
    const built =
      typeof calendar.buildCalendarEvents === 'function'
        ? calendar.buildCalendarEvents(tender)
        : tender
    let list: BuiltCalendarEvent[] = []
    if (built && typeof built === 'object' && 'calendarEvents' in built) {
      const raw = (built as { calendarEvents?: BuiltCalendarEvent[] }).calendarEvents
      list = Array.isArray(raw) ? raw : []
    }
    const exportTender = toCalendarExportInput(tender)
    const meta = metaByTenderId?.get(tender.id)
    return list.map((event) => {
      const eventType = event.type === 'closing' ? 'closing' : 'briefing'
      const googleCalendarUrl = buildGoogleCalendarUrl(exportTender, eventType)
      return {
        ...event,
        href: eventHref(userType, event.tenderId || tender.id),
        requestId: meta?.requestId,
        scopeSource: meta?.scopeSource,
        googleCalendarUrl,
        exportTender,
        exportReady: true,
        providers: {
          googleCalendar: googleCalendarUrl || 'unavailable',
          outlook: 'ics',
          ics: 'ready',
        },
      } satisfies ScopedCalendarEvent
    })
  })
}

async function resolveSmeTenderIds(
  uid: string,
  storage: { getAttendanceRequests: (filters?: Record<string, unknown>) => Promise<AttendanceRequest[]> }
): Promise<{ ids: Set<string>; meta: Map<string, { requestId?: string; scopeSource?: ScopedCalendarEvent['scopeSource'] }> }> {
  const smeWorkspace = require('../../../../backend/services/smeWorkspaceService.js') as {
    getWorkspaceDoc: (userId: string) => Promise<{
      savedTenderIds?: string[]
      trackedTenderIds?: string[]
    }>
  }

  const [workspace, requests] = await Promise.all([
    smeWorkspace.getWorkspaceDoc(uid),
    storage.getAttendanceRequests({ smeId: uid }),
  ])

  const meta = new Map<string, { requestId?: string; scopeSource?: ScopedCalendarEvent['scopeSource'] }>()
  const ids = new Set<string>()

  for (const id of workspace.savedTenderIds || []) {
    ids.add(id)
    if (!meta.has(id)) meta.set(id, { scopeSource: 'saved' })
  }
  for (const id of workspace.trackedTenderIds || []) {
    ids.add(id)
    if (!meta.has(id)) meta.set(id, { scopeSource: 'tracked' })
  }
  for (const request of requests) {
    if (!ACTIVE_ATTENDANCE.has(request.status)) continue
    if (!request.tenderId) continue
    ids.add(request.tenderId)
    meta.set(request.tenderId, {
      requestId: request.id,
      scopeSource: 'attendance',
    })
  }

  return { ids, meta }
}

async function resolveAgentTenderIds(
  uid: string,
  storage: { getAttendanceRequests: (filters?: Record<string, unknown>) => Promise<AttendanceRequest[]> }
): Promise<{ ids: Set<string>; meta: Map<string, { requestId?: string; scopeSource?: ScopedCalendarEvent['scopeSource'] }> }> {
  const [mine, pending] = await Promise.all([
    storage.getAttendanceRequests({ agentId: uid }),
    storage.getAttendanceRequests({ status: 'pending' }),
  ])

  const meta = new Map<string, { requestId?: string; scopeSource?: ScopedCalendarEvent['scopeSource'] }>()
  const ids = new Set<string>()

  for (const request of mine) {
    if (request.status === 'cancelled') continue
    if (!['assigned', 'accepted', 'pending', 'completed'].includes(request.status)) continue
    if (!request.tenderId) continue
    ids.add(request.tenderId)
    meta.set(request.tenderId, {
      requestId: request.id,
      scopeSource: request.status === 'pending' ? 'opportunity' : 'assignment',
    })
  }

  // Available opportunities explicitly notified to this agent (not the whole pending catalogue)
  for (const request of pending) {
    if (!request.tenderId) continue
    const notified =
      Array.isArray(request.notifiedAgents) && request.notifiedAgents.includes(uid)
    if (!notified) continue
    ids.add(request.tenderId)
    if (!meta.has(request.tenderId)) {
      meta.set(request.tenderId, {
        requestId: request.id,
        scopeSource: 'opportunity',
      })
    }
  }

  return { ids, meta }
}

export async function GET(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access

  try {
    const storage = backend.getStorage()
    const calendar = backend.calendar()
    const { searchParams } = new URL(request.url)

    const tenderId = searchParams.get('tenderId')
    // Catalogue is admin-only. SMEs/agents always get a personal feed (unless fetching one tender).
    const wantCatalogue = access.userType === 'admin' || Boolean(tenderId)

    let tenders = await storage.getTenderBriefings()
    let metaByTenderId:
      | Map<string, { requestId?: string; scopeSource?: ScopedCalendarEvent['scopeSource'] }>
      | undefined

    if (tenderId) {
      const tender = await storage.getTenderBriefingById(tenderId)
      tenders = tender ? [tender] : []
    } else if (!wantCatalogue) {
      if (access.userType === 'sme') {
        const { ids, meta } = await resolveSmeTenderIds(access.uid, storage)
        metaByTenderId = meta
        tenders = tenders.filter((t) => ids.has(t.id))
      } else if (access.userType === 'youth-agent') {
        const { ids, meta } = await resolveAgentTenderIds(access.uid, storage)
        metaByTenderId = meta
        tenders = tenders.filter((t) => ids.has(t.id))
      }
    } else if (access.userType === 'admin' && !tenderId) {
      // Admin catalogue: prefer compulsory, else any tender with a briefing date
      const compulsoryTenders = tenders.filter((t) => t.briefingCompulsory === true)
      tenders =
        compulsoryTenders.length > 0
          ? compulsoryTenders
          : tenders.filter((t) => Boolean(t.briefingDate))
      metaByTenderId = new Map(
        tenders.map((t) => [t.id, { scopeSource: 'catalogue' as const }])
      )
    }

    // Personal feeds: keep tenders that have briefing or closing markers
    if (!wantCatalogue) {
      tenders = tenders.filter((t) => Boolean(t.briefingDate) || Boolean(t.closingDate))
    }

    const events = buildEventsForTenders(
      tenders,
      calendar,
      access.userType,
      metaByTenderId
    )

    return NextResponse.json({
      success: true,
      data: events,
      count: events.length,
      scope: wantCatalogue ? 'catalogue' : 'mine',
      userType: access.userType,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load calendar events',
      },
      { status: 500 }
    )
  }
}
