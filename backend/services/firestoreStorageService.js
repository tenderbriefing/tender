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
  lastError: null,
  apiHealth: 'unknown',
  scraperHealth: 'unknown',
})

async function getAllTenders(filters = {}) {
  const db = getFirestore()
  const snapshot = await db.collection(COLLECTIONS.TENDER_BRIEFINGS).get()
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

async function getAttendanceRequests(filters = {}) {
  const db = getFirestore()
  let query = db.collection(COLLECTIONS.ATTENDANCE_REQUESTS)

  if (filters.status) {
    query = query.where('status', '==', filters.status)
  }

  const snapshot = await query.get()
  let items = snapshot.docs.map((doc) => docToObject(doc))

  if (filters.smeId) items = items.filter((r) => r.smeId === filters.smeId)
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

  const snapshot = await query.get()
  let items = snapshot.docs.map((doc) => docToObject(doc))

  if (filters.requestId) items = items.filter((r) => r.requestId === filters.requestId)
  if (filters.agentId) items = items.filter((r) => r.agentId === filters.agentId)

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

module.exports = {
  COLLECTIONS,
  getAllTenders,
  getTenderById,
  upsertTenders,
  saveAttendanceRequest,
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
}
