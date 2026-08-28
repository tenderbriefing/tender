const storageAdapter = require('./storageAdapter')
const firebaseAdmin = require('../config/firebaseAdmin')

/** Max activities returned to the client (sorted newest-first). */
const ACTIVITY_LIMIT = 50
/** Cap for role-scoped Firestore reads feeding the activity feed. */
const QUERY_LIMIT = 50
/** Admin/founder remain platform-wide but must not unbound-scan. */
const ADMIN_QUERY_LIMIT = 50

function toIso(value) {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function tenderLabel(req) {
  return req.tenderNumber || req.tenderTitle || req.tenderId || 'tender'
}

function notificationTitle(eventType) {
  switch (eventType) {
    case 'sme_requested_attendance':
      return 'Attendance requested'
    case 'agent_accepted_briefing':
      return 'Agent assigned'
    case 'agent_declined_briefing':
      return 'Agent declined'
    case 'briefing_report_submitted':
      return 'Briefing report uploaded'
    case 'attendance_request_completed':
      return 'Request completed'
    case 'sme_saved_tender':
      return 'Tender saved'
    case 'sme_tracked_tender':
      return 'Tender tracked'
    default:
      return (eventType || 'update').replace(/_/g, ' ')
  }
}

function notificationHref(eventType, data, userType) {
  const requestId = data?.requestId
  const tenderId = data?.tenderId
  if (requestId) {
    if (userType === 'youth-agent') return `/agent/dashboard`
    return `/sme/requests/${requestId}`
  }
  if (tenderId) return `/tenders/${tenderId}`
  if (userType === 'admin' && eventType?.includes('sync')) return '/admin/integrations'
  return '/notifications'
}

function sortAndLimit(items) {
  return items
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, ACTIVITY_LIMIT)
}

function dedupeActivities(items) {
  const deduped = []
  const seen = new Set()
  for (const item of sortAndLimit(items)) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    deduped.push(item)
  }
  return deduped
}

async function loadSmeWorkspaceActivities(userId) {
  const db = firebaseAdmin.getFirestore()
  const baseRef = db.collection('smeWorkspace').doc(userId)
  const [savedSnap, trackedSnap] = await Promise.all([
    baseRef.collection('savedTenders').limit(10).get(),
    baseRef.collection('trackedTenders').limit(10).get(),
  ])

  const items = []
  for (const doc of savedSnap.docs) {
    const d = doc.data()
    items.push({
      id: `saved-${doc.id}`,
      type: 'tender_saved',
      title: 'Tender saved',
      description: d.title || d.tenderNumber || doc.id,
      createdAt: toIso(d.createdAt),
      href: `/tenders/${doc.id}`,
      status: 'saved',
    })
  }
  for (const doc of trackedSnap.docs) {
    const d = doc.data()
    items.push({
      id: `tracked-${doc.id}`,
      type: 'tender_tracked',
      title: 'Tender tracked',
      description: d.title || d.tenderNumber || doc.id,
      createdAt: toIso(d.createdAt),
      href: `/tenders/${doc.id}`,
      status: 'tracked',
    })
  }
  return items
}

function pushSmeRequestActivities(items, mine) {
  for (const req of mine) {
    items.push({
      id: `req-${req.id}`,
      type: 'attendance_requested',
      title: 'Attendance requested',
      description: `Briefing attendance request for ${tenderLabel(req)}`,
      createdAt: toIso(req.createdAt || req.updatedAt),
      href: `/sme/requests/${req.id}`,
      status: req.status || 'pending',
    })
  }
}

function pushSmeReportActivities(items, reports) {
  for (const report of reports) {
    items.push({
      id: `report-${report.id}`,
      type: 'briefing_report_submitted',
      title: 'Briefing report received',
      description: report.summary
        ? String(report.summary).slice(0, 120)
        : `Report submitted for request ${report.requestId}`,
      createdAt: toIso(report.createdAt || report.submittedAt),
      href: `/sme/requests/${report.requestId}`,
      status: 'completed',
    })
  }
}

function pushYouthAgentRequestActivities(items, requests, uid) {
  for (const req of requests) {
    const isMine = req.assignedAgentId === uid || req.agentId === uid
    const declined =
      req.status === 'declined' &&
      Array.isArray(req.declinedAgentIds) &&
      req.declinedAgentIds.includes(uid)

    if (declined) {
      items.push({
        id: `declined-${req.id}`,
        type: 'briefing_declined',
        title: 'Briefing declined',
        description: `You declined ${tenderLabel(req)}`,
        createdAt: toIso(req.updatedAt || req.createdAt),
        href: '/jobs',
        status: 'declined',
      })
      continue
    }

    if (req.status === 'pending' && !isMine) {
      items.push({
        id: `available-${req.id}`,
        type: 'job_available',
        title: 'Assignment available',
        description: `New briefing assignment: ${tenderLabel(req)}`,
        createdAt: toIso(req.createdAt),
        href: '/jobs',
        status: 'available',
      })
      continue
    }

    if (isMine) {
      items.push({
        id: `assigned-${req.id}`,
        type:
          req.status === 'assigned' || req.status === 'accepted'
            ? 'briefing_accepted'
            : 'briefing_assigned',
        title: req.status === 'completed' ? 'Briefing completed' : 'Briefing assigned',
        description: `${tenderLabel(req)} — ${req.status || 'assigned'}`,
        createdAt: toIso(req.updatedAt || req.acceptedAt || req.createdAt),
        href: '/agent/dashboard',
        status: req.status || 'assigned',
      })
    }
  }
}

function pushYouthAgentReportActivities(items, reports) {
  for (const report of reports) {
    items.push({
      id: `agent-report-${report.id}`,
      type: 'report_submitted',
      title: 'Report submitted',
      description: report.summary
        ? String(report.summary).slice(0, 120)
        : `Briefing report for ${report.requestId}`,
      createdAt: toIso(report.createdAt || report.submittedAt),
      href: '/agent/dashboard',
      status: 'completed',
    })
  }
}

function pushNotificationActivities(items, notifications, userType) {
  for (const n of notifications || []) {
    items.push({
      id: `notif-${n.id}`,
      type: n.eventType || 'notification',
      title: n.title || notificationTitle(n.eventType),
      description: n.message || notificationTitle(n.eventType),
      createdAt: toIso(n.createdAt),
      href: notificationHref(n.eventType, n.data || {}, userType),
      status: n.read ? 'read' : 'pending',
    })
  }
}

async function loadSmeActivities(storage, uid, items) {
  const mine = await storage.getAttendanceRequests({ smeId: uid, limit: QUERY_LIMIT })
  pushSmeRequestActivities(items, mine)

  const myRequestIds = mine.map((r) => r.id).filter(Boolean)
  if (myRequestIds.length > 0) {
    const reports = await storage.getBriefingReports({
      requestIds: myRequestIds.slice(0, 30),
      limit: QUERY_LIMIT,
    })
    const allowed = new Set(myRequestIds)
    pushSmeReportActivities(
      items,
      (reports || []).filter((r) => allowed.has(r.requestId))
    )
  }

  try {
    items.push(...(await loadSmeWorkspaceActivities(uid)))
  } catch {
    // Workspace subcollections may be empty or index missing — non-fatal
  }
}

async function loadYouthAgentActivities(storage, uid, items) {
  const [mine, pending, reports] = await Promise.all([
    storage.getAttendanceRequests({ agentId: uid, limit: QUERY_LIMIT }),
    storage.getAttendanceRequests({ status: 'pending', limit: QUERY_LIMIT }),
    storage.getBriefingReports({ agentId: uid, limit: QUERY_LIMIT }),
  ])

  const byId = new Map()
  for (const req of mine || []) {
    if (req?.id) byId.set(req.id, req)
  }
  // Preserve prior semantics: unassigned pending jobs are visible as available.
  for (const req of pending || []) {
    if (!req?.id || byId.has(req.id)) continue
    if (req.status === 'pending' && !req.assignedAgentId) {
      byId.set(req.id, req)
    }
  }

  pushYouthAgentRequestActivities(items, [...byId.values()], uid)
  pushYouthAgentReportActivities(
    items,
    (reports || []).filter((r) => r.agentId === uid)
  )
}

async function loadAdminActivities(storage, items) {
  // Platform-wide (not tenant-restricted). Bound reads only — do not add SME/agent filters.
  const [requests, reports] = await Promise.all([
    storage.getAttendanceRequests({ limit: ADMIN_QUERY_LIMIT }),
    storage.getBriefingReports({ limit: ADMIN_QUERY_LIMIT }),
  ])

  for (const req of (requests || []).slice(0, 15)) {
    items.push({
      id: `admin-req-${req.id}`,
      type: 'attendance_requested',
      title: 'Attendance request',
      description: `${tenderLabel(req)} — ${req.status || 'pending'}`,
      createdAt: toIso(req.createdAt),
      href: '/admin/operations',
      status: req.status || 'pending',
    })
  }

  for (const report of (reports || []).slice(0, 10)) {
    items.push({
      id: `admin-report-${report.id}`,
      type: 'briefing_report_submitted',
      title: 'Report uploaded',
      description: `Report for request ${report.requestId}`,
      createdAt: toIso(report.createdAt),
      href: '/admin/operations',
      status: 'completed',
    })
  }

  try {
    const syncStatus = await storage.getSyncStatus?.()
    if (syncStatus?.lastSuccessfulSync || syncStatus?.lastRunAt) {
      items.push({
        id: 'sync-status',
        type: 'sync_completed',
        title: 'Tender sync',
        description: syncStatus.isRunning
          ? 'Sync currently running'
          : `Last sync: ${syncStatus.lastSuccessfulSync || syncStatus.lastRunAt}`,
        createdAt: toIso(syncStatus.lastSuccessfulSync || syncStatus.lastRunAt),
        href: '/admin/dashboard',
        status: syncStatus.isRunning ? 'in_progress' : 'completed',
      })
    }
  } catch {
    // ignore
  }

  const adminNotifications = await storage.getNotifications?.({ limit: 15 })
  if (adminNotifications?.length) {
    for (const n of adminNotifications) {
      items.push({
        id: `admin-notif-${n.id}`,
        type: n.eventType || 'notification',
        title: notificationTitle(n.eventType),
        description: n.message || n.title || notificationTitle(n.eventType),
        createdAt: toIso(n.createdAt),
        href: notificationHref(n.eventType, n.data || {}, 'admin'),
        status: n.read ? 'read' : 'pending',
      })
    }
  }
}

/**
 * Role-scoped dashboard activity feed.
 * SME / youth-agent: query-level tenant filters + caps (no full-collection scan).
 * Admin: platform-wide but capped (ADMIN_QUERY_LIMIT). Founder/other: notifications only.
 */
async function getActivitiesForUser(user) {
  const storage = storageAdapter.getStorage()
  const { uid, userType } = user
  const items = []

  const notificationsPromise =
    storage.getNotifications?.({ userId: uid, limit: 30 }) || Promise.resolve([])

  if (userType === 'sme') {
    await loadSmeActivities(storage, uid, items)
  } else if (userType === 'youth-agent') {
    await loadYouthAgentActivities(storage, uid, items)
  } else if (userType === 'admin') {
    await loadAdminActivities(storage, items)
  }
  // Founder / unknown roles: do not inherit admin platform scans without evidence.
  // They still receive user-scoped notifications below.

  const notifications = await notificationsPromise
  pushNotificationActivities(items, notifications, userType)

  return dedupeActivities(items)
}

module.exports = {
  getActivitiesForUser,
  ACTIVITY_LIMIT,
  QUERY_LIMIT,
  ADMIN_QUERY_LIMIT,
}
