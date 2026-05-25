/**
 * Agent field app — sessions, sync queue, telemetry, location pings, earnings.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso } = require('../ai/_shared')
const mobileOps = require('./mobileOpsService')
const agentPerformance = require('../agentPerformanceService')
const payoutService = require('../finance/payoutService')
const { getStorage } = require('../storageAdapter')

const COL = {
  sessions: 'mobileSessions',
  syncQueue: 'mobileSyncQueue',
  telemetry: 'mobileTelemetry',
  locationPings: 'agentLocationPings',
}

async function startSession(agentId, meta = {}) {
  const db = getFirestore()
  const doc = sanitizeFirestoreData({
    agentId,
    startedAt: nowIso(),
    lastActiveAt: nowIso(),
    platform: meta.platform || 'pwa',
    userAgent: meta.userAgent || '',
    online: meta.online !== false,
  })
  const ref = await db.collection(COL.sessions).add(doc)
  return { id: ref.id, ...doc }
}

async function touchSession(sessionId) {
  if (!sessionId) return
  const db = getFirestore()
  await db
    .collection(COL.sessions)
    .doc(sessionId)
    .set({ lastActiveAt: nowIso() }, { merge: true })
}

async function recordTelemetry(agentId, event, metadata = {}, sessionId = null) {
  const db = getFirestore()
  const doc = sanitizeFirestoreData({
    agentId,
    sessionId,
    event,
    metadata,
    createdAt: nowIso(),
  })
  const ref = await db.collection(COL.telemetry).add(doc)
  return { id: ref.id, ...doc }
}

async function recordLocationPing(agentId, payload) {
  const db = getFirestore()
  const doc = sanitizeFirestoreData({
    agentId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    accuracy: payload.accuracy ?? null,
    requestId: payload.requestId || null,
    source: payload.source || 'pwa',
    createdAt: nowIso(),
  })
  const ref = await db.collection(COL.locationPings).add(doc)
  await db.collection('agents').doc(agentId).set(
    {
      latitude: payload.latitude,
      longitude: payload.longitude,
      lastLocationAt: nowIso(),
      updatedAt: nowIso(),
    },
    { merge: true }
  )
  return { id: ref.id, ...doc }
}

async function enqueueSyncItem(agentId, item) {
  const db = getFirestore()
  const doc = sanitizeFirestoreData({
    agentId,
    itemType: item.itemType,
    payload: item.payload || {},
    status: 'queued',
    clientTimestamp: item.clientTimestamp || nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })
  const ref = await db.collection(COL.syncQueue).add(doc)
  return { id: ref.id, ...doc }
}

async function processSyncQueue(agentId, limit = 20) {
  const db = getFirestore()
  const snap = await db
    .collection(COL.syncQueue)
    .where('agentId', '==', agentId)
    .where('status', '==', 'queued')
    .limit(limit)
    .get()

  const processed = []
  for (const doc of snap.docs) {
    const data = doc.data()
    try {
      if (data.itemType === 'check_in' || data.itemType === 'check_out') {
        await mobileOps.gpsAttendance.recordGpsEvent({
          ...data.payload,
          agentId,
          eventType: data.itemType === 'check_in' ? 'check_in' : 'check_out',
        })
      } else if (data.itemType === 'telemetry') {
        await recordTelemetry(agentId, data.payload.event, data.payload.metadata || {})
      }
      await doc.ref.set({ status: 'synced', syncedAt: nowIso(), updatedAt: nowIso() }, { merge: true })
      processed.push(doc.id)
    } catch (err) {
      await doc.ref.set(
        {
          status: 'failed',
          error: err.message,
          updatedAt: nowIso(),
        },
        { merge: true }
      )
    }
  }
  return { processed, count: processed.length }
}

async function getMobileDispatchBoard(agentId) {
  const raw = await mobileOps.getAgentDispatch(agentId)
  const items = raw.map((row) => {
    const r = row.request || {}
    const opt = row.optimization || {}
    const top = opt.candidates?.[0] || opt.optimalAgent
    return {
      requestId: r.id,
      tenderId: r.tenderId,
      tenderNumber: r.tenderNumber,
      tenderTitle: r.tenderTitle || r.title,
      province: r.province,
      department: r.department,
      briefingDate: r.briefingDate,
      briefingTime: r.briefingTime,
      briefingVenue: r.briefingVenue,
      status: r.status,
      paymentStatus: r.paymentStatus,
      payoutCents: r.paymentAmount || 24900,
      payoutZar: `R${((r.paymentAmount || 24900) / 100).toFixed(2)}`,
      assignedToMe: r.agentId === agentId || r.assignedAgentId === agentId,
      canAccept: r.status === 'pending' && (r.paymentStatus === 'paid' || r.paymentStatus === 'not_required'),
      etaMinutes: top?.etaMinutes ?? null,
      distanceKm: top?.distanceKm ?? null,
      urgency: top?.escalationRisk >= 60 ? 'high' : r.briefingDate ? 'normal' : 'low',
      dispatchScore: top?.dispatchScore ?? null,
      paidAt: r.paidAt,
    }
  })
  return {
    assignments: items.filter((i) => i.assignedToMe && i.status !== 'pending'),
    opportunities: items.filter((i) => i.canAccept || (i.assignedToMe && i.status === 'assigned')),
    all: items,
  }
}

async function getBriefingDetail(requestId, agentId) {
  const storage = getStorage()
  const request = await storage.getAttendanceRequests().then((list) => list.find((x) => x.id === requestId))
  if (!request) return null

  const tenders = await storage.getAllTenders()
  const tender = tenders.find((t) => t.id === request.tenderId) || {}

  let aiSummary = null
  try {
    const db = getFirestore()
    const insight = await db.collection('aiTenderInsights').doc(String(tender.id || request.tenderId)).get()
    if (insight.exists) aiSummary = insight.data()
    else {
      const tenderSummary = require('../ai/tenderSummaryService')
      aiSummary = await tenderSummary.generateTenderSummary({ ...tender, id: tender.id || request.tenderId })
    }
  } catch {
    aiSummary = null
  }

  const gpsSnap = await getFirestore()
    .collection('gpsAttendanceLogs')
    .where('requestId', '==', requestId)
    .where('agentId', '==', agentId)
    .limit(10)
    .get()
  const gpsEvents = gpsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  return {
    request,
    tender,
    aiSummary,
    gpsEvents,
    coordinates: {
      lat: request.briefingLatitude ?? tender.latitude ?? null,
      lng: request.briefingLongitude ?? tender.longitude ?? null,
    },
  }
}

async function getAgentEarnings(agentId) {
  const db = getFirestore()
  const storage = getStorage()
  const [payoutSnap, requests] = await Promise.all([
    db.collection('financePayouts').where('agentId', '==', agentId).limit(50).get().catch(() => ({ docs: [] })),
    storage.getAttendanceRequests(),
  ])

  const completed = requests.filter(
    (r) => (r.agentId === agentId || r.assignedAgentId === agentId) && r.status === 'completed'
  )
  const payouts = payoutSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const pending = payouts.filter((p) => p.status === 'pending' || p.status === 'processing')
  const paid = payouts.filter((p) => p.status === 'paid')
  const pendingCents = pending.reduce((s, p) => s + (p.amountCents || 0), 0)
  const paidCents = paid.reduce((s, p) => s + (p.amountCents || 0), 0)

  const month = new Date().toISOString().slice(0, 7)
  const monthPaid = paid
    .filter((p) => String(p.createdAt || '').startsWith(month))
    .reduce((s, p) => s + (p.amountCents || 0), 0)

  return {
    completedBriefings: completed.length,
    pendingPayoutCents: pendingCents,
    paidEarningsCents: paidCents,
    monthEarningsCents: monthPaid,
    payouts: payouts.slice(0, 20),
  }
}

async function getAgentPerformanceMobile(agentId) {
  const ranked = await agentPerformance.rankAllAgents()
  const me = ranked.find((r) => r.agentId === agentId)
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const mine = requests.filter((r) => r.agentId === agentId || r.assignedAgentId === agentId)
  const total = mine.length || 1
  const completed = mine.filter((r) => r.status === 'completed').length
  const missed = mine.filter((r) => r.status === 'missed').length

  const db = getFirestore()
  const fraudSnap = await db
    .collection('fraudAlerts')
    .where('agentId', '==', agentId)
    .limit(10)
    .get()
    .catch(() => ({ docs: [] }))

  return {
    tier: me?.tier || 'Silver',
    performanceScore: me?.performanceScore ?? 50,
    reliabilityScore: me?.reliabilityScore ?? 100,
    attendancePct: Math.round((completed / total) * 1000) / 10,
    missedBriefings: missed,
    reportQuality: me?.reportingQuality ?? 50,
    fraudFlags: fraudSnap.docs.length,
    latenessPct: 0,
  }
}

async function getLiveFieldMap() {
  const db = getFirestore()
  const [pings, gpsSnap, trackingSnap] = await Promise.all([
    db.collection(COL.locationPings).orderBy('createdAt', 'desc').limit(80).get().catch(() => ({ docs: [] })),
    db.collection('gpsAttendanceLogs').limit(100).get(),
    db.collection('dispatchTracking').limit(50).get(),
  ])

  const agents = {}
  for (const doc of pings.docs || []) {
    const d = doc.data()
    agents[d.agentId] = {
      agentId: d.agentId,
      lat: d.latitude,
      lng: d.longitude,
      lastPing: d.createdAt,
    }
  }

  const activeCheckIns = gpsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.eventType === 'check_in' && !gpsSnap.docs.find(() => false))
    .slice(0, 30)

  const tracking = trackingSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  return { agents: Object.values(agents), activeCheckIns, tracking }
}

module.exports = {
  COL,
  startSession,
  touchSession,
  recordTelemetry,
  recordLocationPing,
  enqueueSyncItem,
  processSyncQueue,
  getMobileDispatchBoard,
  getBriefingDetail,
  getAgentEarnings,
  getAgentPerformanceMobile,
  getLiveFieldMap,
}
