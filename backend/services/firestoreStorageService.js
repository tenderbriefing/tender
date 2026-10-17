const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const COLLECTIONS = {
  TENDER_BRIEFINGS: 'tenderBriefings',
  ATTENDANCE_REQUESTS: 'attendanceRequests',
  BRIEFING_REPORTS: 'briefingReports',
  AUDIT_LOGS: 'auditLogs',
  SYNC_STATUS: 'syncStatus',
  NOTIFICATIONS: 'notifications',
  AGENTS: 'agents',
  SMES: 'smes',
}

const SYNC_STATUS_DOC_ID = 'current'
const BATCH_SIZE = 400

function docToObject(doc) {
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() }
}

function applyTenderFilters(items, filters = {}) {
  let result = items

  if (filters.ownerUid) {
    result = result.filter(
      (t) =>
        t.visibility !== 'private' ||
        t.ownerUid === filters.ownerUid ||
        filters.includePrivate === true
    )
  } else if (!filters.includePrivate) {
    result = result.filter((t) => t.visibility !== 'private')
  }

  if (filters.compulsoryOnly) {
    result = result.filter((t) => t.briefingCompulsory === true)
  }
  if (filters.province) {
    result = result.filter(
      (t) => t.province?.toLowerCase() === filters.province.toLowerCase()
    )
  }
  if (filters.sector) {
    result = result.filter(
      (t) => t.industrySector?.toLowerCase() === filters.sector.toLowerCase()
    )
  }
  if (filters.status) {
    result = result.filter((t) => t.status === filters.status)
  }

  return result.sort(
    (a, b) =>
      new Date(b.lastSyncedAt || b.scrapedAt || 0) -
      new Date(a.lastSyncedAt || a.scrapedAt || 0)
  )
}

const defaultSyncState = () => ({
  lastSuccessfulSync: null,
  lastIncrementalSync: null,
  lastFullReconciliation: null,
  syncLogs: [],
  isRunning: false,
  lockAcquiredAt: null,
  lastError: null,
  apiHealth: 'unknown',
  scraperHealth: 'unknown',
})

/**
 * Catalogue loaders
 *
 * Unbounded: omit `limit` (sync / reconciliation / operator jobs only).
 * Bounded UI: pass `limit` (hard cap 5000). A cap is a guardrail — never present
 * a bounded list length as an exact platform total; use countDocuments() or
 * platformStats/catalogue for totals.
 */
const TENDER_BOUNDED_HARD_CAP = 5000
const ATTENDANCE_BOUNDED_HARD_CAP = 2000

async function getAllTenders(filters = {}) {
  const db = getFirestore()
  let query = db.collection(COLLECTIONS.TENDER_BRIEFINGS)
  const cap = Number(filters.limit)
  if (Number.isFinite(cap) && cap > 0) {
    query = query.limit(Math.min(cap, TENDER_BOUNDED_HARD_CAP))
  }
  const snapshot = await query.get()
  const items = snapshot.docs.map((doc) => docToObject(doc))
  return applyTenderFilters(items, filters)
}

async function getTenderById(id) {
  const db = getFirestore()

  const direct = await db.collection(COLLECTIONS.TENDER_BRIEFINGS).doc(id).get()
  if (direct.exists) return docToObject(direct)

  const byOcid = await db
    .collection(COLLECTIONS.TENDER_BRIEFINGS)
    .where('ocid', '==', id)
    .limit(1)
    .get()
  if (!byOcid.empty) return docToObject(byOcid.docs[0])

  const byNumber = await db
    .collection(COLLECTIONS.TENDER_BRIEFINGS)
    .where('tenderNumber', '==', String(id))
    .limit(1)
    .get()
  if (!byNumber.empty) return docToObject(byNumber.docs[0])

  return null
}

/** Batch fetch tenders by document id (chunks of 10 for Firestore getAll). */
async function getTendersByIds(ids = []) {
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!unique.length) return []

  const db = getFirestore()
  const byId = new Map()

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10)
    const refs = chunk.map((id) => db.collection(COLLECTIONS.TENDER_BRIEFINGS).doc(id))
    const snaps = await db.getAll(...refs)
    for (const snap of snaps) {
      if (snap.exists) {
        const row = docToObject(snap)
        if (row?.id) byId.set(row.id, row)
      }
    }
  }

  const missing = unique.filter((id) => !byId.has(id))
  for (const id of missing) {
    const row = await getTenderById(id)
    if (row?.id) byId.set(row.id, row)
  }

  return unique.map((id) => byId.get(id)).filter(Boolean)
}

async function upsertTenders(tenders) {
  if (!tenders?.length) return { written: 0 }

  const db = getFirestore()
  let written = 0

  for (let i = 0; i < tenders.length; i += BATCH_SIZE) {
    const chunk = tenders.slice(i, i + BATCH_SIZE)
    const batch = db.batch()

    for (const tender of chunk) {
      const docId = tender.id || `tb-${tender.tenderNumber || tender.ocid}`
      const ref = db.collection(COLLECTIONS.TENDER_BRIEFINGS).doc(docId)
      batch.set(ref, sanitizeFirestoreData({ ...tender, id: docId }), { merge: true })
      written += 1
    }

    await batch.commit()
  }

  return { written }
}

async function saveAttendanceRequest(request) {
  const db = getFirestore()
  const docId = request.id
  await db
    .collection(COLLECTIONS.ATTENDANCE_REQUESTS)
    .doc(docId)
    .set(sanitizeFirestoreData(request), { merge: true })
  return request
}

/** Direct document lookup. Do not use getAttendanceRequests() to find one id. */
async function getAttendanceRequestById(id) {
  if (!id) return null
  const db = getFirestore()
  const snap = await db.collection(COLLECTIONS.ATTENDANCE_REQUESTS).doc(String(id)).get()
  return snap.exists ? docToObject(snap) : null
}

async function getAttendanceRequests(filters = {}) {
  const db = getFirestore()
  let query = db.collection(COLLECTIONS.ATTENDANCE_REQUESTS)

  if (filters.status) {
    query = query.where('status', '==', filters.status)
  }

  if (filters.smeId) {
    query = query.where('smeId', '==', filters.smeId)
  } else if (filters.agentId) {
    query = query.where('assignedAgentId', '==', filters.agentId)
  }

  const cap = Number(filters.limit)
  if (Number.isFinite(cap) && cap > 0) {
    query = query.limit(Math.min(cap, ATTENDANCE_BOUNDED_HARD_CAP))
  }

  const snapshot = await query.get()
  let items = snapshot.docs.map((doc) => docToObject(doc))

  if (filters.agentId) {
    items = items.filter(
      (r) => r.agentId === filters.agentId || r.assignedAgentId === filters.agentId
    )
  }
  if (filters.availableForAgent) {
    const agentId = filters.availableForAgent
    items = items.filter((r) => {
      const status = r.status === 'accepted' ? 'assigned' : r.status
      const paid =
        r.paymentStatus === 'paid' || r.paymentStatus === 'not_required'
      if (status === 'pending') return paid
      if (status === 'assigned' && (r.assignedAgentId === agentId || r.agentId === agentId)) {
        return true
      }
      return false
    })
  }

  return items.sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )
}

async function saveBriefingReport(report) {
  const db = getFirestore()
  const docId = report.id
  await db
    .collection(COLLECTIONS.BRIEFING_REPORTS)
    .doc(docId)
    .set(sanitizeFirestoreData(report), { merge: true })
  return report
}

async function getBriefingReports(filters = {}) {
  const db = getFirestore()
  let query = db.collection(COLLECTIONS.BRIEFING_REPORTS)

  if (filters.tenderId) {
    query = query.where('tenderId', '==', filters.tenderId)
  }

  if (filters.agentId) {
    query = query.where('agentId', '==', filters.agentId)
  }

  const requestIds = Array.isArray(filters.requestIds)
    ? [...new Set(filters.requestIds.filter(Boolean))].slice(0, 30)
    : null

  if (filters.requestId) {
    query = query.where('requestId', '==', filters.requestId)
  } else if (requestIds && requestIds.length === 1) {
    query = query.where('requestId', '==', requestIds[0])
  } else if (requestIds && requestIds.length > 1) {
    query = query.where('requestId', 'in', requestIds)
  }

  const cap = Number(filters.limit)
  if (Number.isFinite(cap) && cap > 0) {
    query = query.limit(Math.min(cap, ATTENDANCE_BOUNDED_HARD_CAP))
  }

  const snapshot = await query.get()
  let items = snapshot.docs.map((doc) => docToObject(doc))

  // Defensive post-filters when callers pass ids without relying on query alone
  if (filters.requestId) {
    items = items.filter((r) => r.requestId === filters.requestId)
  }
  if (requestIds && requestIds.length) {
    const allowed = new Set(requestIds)
    items = items.filter((r) => allowed.has(r.requestId))
  }
  if (filters.agentId) {
    items = items.filter((r) => r.agentId === filters.agentId)
  }

  return items.sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )
}

async function saveAuditLog(log) {
  const db = getFirestore()
  const docId = log.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const entry = sanitizeFirestoreData({
    ...log,
    id: docId,
    timestamp: log.timestamp || new Date().toISOString(),
  })
  await db.collection(COLLECTIONS.AUDIT_LOGS).doc(docId).set(entry, { merge: true })
  return entry
}

async function getAuditLogs(filters = {}) {
  const db = getFirestore()
  const limit = filters.limit || 200

  let query = db
    .collection(COLLECTIONS.AUDIT_LOGS)
    .orderBy('timestamp', 'desc')
    .limit(limit)

  if (filters.type) {
    query = db
      .collection(COLLECTIONS.AUDIT_LOGS)
      .where('type', '==', filters.type)
      .orderBy('timestamp', 'desc')
      .limit(limit)
  }

  const snapshot = await query.get()
  let items = snapshot.docs.map((doc) => docToObject(doc))

  if (filters.entityId) {
    items = items.filter((e) => e.entityId === filters.entityId)
  }

  return items
}

async function getSyncStatus() {
  const db = getFirestore()
  const doc = await db
    .collection(COLLECTIONS.SYNC_STATUS)
    .doc(SYNC_STATUS_DOC_ID)
    .get()

  if (!doc.exists) return defaultSyncState()
  return { ...defaultSyncState(), ...doc.data() }
}

async function saveSyncStatus(status) {
  const db = getFirestore()
  const payload = sanitizeFirestoreData(status)
  await db
    .collection(COLLECTIONS.SYNC_STATUS)
    .doc(SYNC_STATUS_DOC_ID)
    .set(payload, { merge: true })
  return payload
}

async function saveNotification(notification) {
  const db = getFirestore()
  const docId =
    notification.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const entry = sanitizeFirestoreData({
    ...notification,
    id: docId,
    createdAt: notification.createdAt || new Date().toISOString(),
    read: notification.read === true,
  })
  await db.collection(COLLECTIONS.NOTIFICATIONS).doc(docId).set(entry, { merge: true })
  return entry
}

async function getNotifications(filters = {}) {
  const db = getFirestore()
  let query = db.collection(COLLECTIONS.NOTIFICATIONS)
  if (filters.userId) {
    query = query.where('userId', '==', filters.userId)
  }
  const snapshot = await query.limit(filters.limit || 50).get()
  return snapshot.docs
    .map((doc) => docToObject(doc))
    .filter((n) => n.channel !== 'whatsapp' && n.type !== 'idempotency_marker')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

async function markNotificationRead(notificationId) {
  const db = getFirestore()
  await db
    .collection(COLLECTIONS.NOTIFICATIONS)
    .doc(notificationId)
    .set(sanitizeFirestoreData({ read: true }), { merge: true })
}

async function markAllNotificationsRead(userId) {
  const items = await getNotifications({ userId, limit: 200 })
  const db = getFirestore()
  const batch = db.batch()
  let count = 0
  for (const item of items) {
    if (!item.read) {
      batch.update(db.collection(COLLECTIONS.NOTIFICATIONS).doc(item.id), { read: true })
      count += 1
      if (count >= 400) break
    }
  }
  if (count > 0) await batch.commit()
}

async function countDocuments(collectionName, equality = {}) {
  const db = getFirestore()
  let query = db.collection(collectionName)
  for (const [field, value] of Object.entries(equality)) {
    if (value !== undefined && value !== null && value !== '') {
      query = query.where(field, '==', value)
    }
  }
  const snap = await query.count().get()
  return snap.data().count
}

/**
 * Cursor page for the public/admin catalogue. Does not load the full collection.
 * Visibility (upcoming compulsory) is applied in-process over a bounded scan budget.
 */
async function listTenderBriefingsPage(filters = {}) {
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 40, 1), 100)
  const scanBudget = Math.min(Math.max(Number(filters.scanBudget) || 160, pageSize), 400)
  const db = getFirestore()
  const col = db.collection(COLLECTIONS.TENDER_BRIEFINGS)
  let lastDoc = null
  if (filters.cursor) {
    const cursorSnap = await col.doc(String(filters.cursor)).get()
    if (cursorSnap.exists) lastDoc = cursorSnap
  }

  const collected = []
  let scanned = 0
  let nextCursor = null
  let exhausted = false

  while (collected.length < pageSize && scanned < scanBudget) {
    const batchSize = Math.min(80, scanBudget - scanned)
    let query = col.where('briefingCompulsory', '==', true).orderBy('lastSyncedAt', 'desc')
    if (filters.province) {
      query = col
        .where('briefingCompulsory', '==', true)
        .where('province', '==', filters.province)
        .orderBy('lastSyncedAt', 'desc')
    }
    query = query.limit(batchSize)
    if (lastDoc) query = query.startAfter(lastDoc)
    const snap = await query.get()
    if (snap.empty) {
      exhausted = true
      break
    }
    scanned += snap.docs.length
    for (const doc of snap.docs) {
      lastDoc = doc
      nextCursor = doc.id
      const item = docToObject(doc)
      if (item.visibility === 'private' && !filters.includePrivate) continue
      collected.push(item)
      if (collected.length >= pageSize) break
    }
    if (snap.docs.length < batchSize) {
      exhausted = true
      break
    }
  }

  return {
    items: collected.slice(0, pageSize),
    nextCursor: exhausted && collected.length < pageSize ? null : nextCursor,
    scanned,
    pageSize,
  }
}

module.exports = {
  COLLECTIONS,
  TENDER_BOUNDED_HARD_CAP,
  ATTENDANCE_BOUNDED_HARD_CAP,
  getAllTenders,
  getTenderById,
  getTendersByIds,
  upsertTenders,
  saveAttendanceRequest,
  getAttendanceRequestById,
  getAttendanceRequests,
  saveBriefingReport,
  getBriefingReports,
  saveAuditLog,
  getAuditLogs,
  getSyncStatus,
  saveSyncStatus,
  saveNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  countDocuments,
  listTenderBriefingsPage,
}
