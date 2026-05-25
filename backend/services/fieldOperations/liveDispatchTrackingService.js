/**
 * Live dispatch tracking — agent movement, ETA, late arrivals.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso } = require('../ai/_shared')
const { predictEtaMinutes } = require('../ai/dispatchOptimizationService')

async function updateDispatchTracking(payload) {
  const db = getFirestore()
  const id = payload.requestId || payload.id
  if (!id) throw new Error('requestId required')

  const data = sanitizeFirestoreData({
    requestId: id,
    agentId: payload.agentId || null,
    status: payload.status || 'dispatched',
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    etaMinutes: payload.etaMinutes ?? predictEtaMinutes(payload.distanceKm, payload.tier),
    arrivedAt: payload.arrivedAt || null,
    lateArrival: Boolean(payload.lateArrival),
    progressPct: payload.progressPct ?? null,
    updatedAt: nowIso(),
    createdAt: payload.createdAt || nowIso(),
  })

  await db.collection('dispatchTracking').doc(String(id)).set(data, { merge: true })
  return { id: String(id), ...data }
}

async function getActiveBriefings() {
  const db = getFirestore()
  const [trackingSnap, requests] = await Promise.all([
    db.collection('dispatchTracking').limit(100).get(),
    require('../storageAdapter').getStorage().getAttendanceRequests(),
  ])

  const active = requests.filter((r) =>
    ['accepted', 'in_progress', 'pending'].includes(r.status)
  )

  const tracking = trackingSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return active.map((r) => ({
    requestId: r.id,
    tenderNumber: r.tenderNumber,
    province: r.province,
    status: r.status,
    agentId: r.agentId,
    tracking: tracking.find((t) => t.requestId === r.id) || null,
  }))
}

module.exports = { updateDispatchTracking, getActiveBriefings }
