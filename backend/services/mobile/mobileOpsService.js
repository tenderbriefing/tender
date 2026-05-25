/**
 * Mobile-ready ops — upload tokens, lightweight APIs, session telemetry.
 */
const crypto = require('crypto')
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso } = require('../ai/_shared')
const liveDispatchTracking = require('../fieldOperations/liveDispatchTrackingService')
const gpsAttendance = require('../fieldOperations/gpsAttendanceService')
const offlineSync = require('../fieldOperations/offlineSyncService')
const dispatchOptimization = require('../ai/dispatchOptimizationService')
const { getStorage } = require('../storageAdapter')

function createUploadToken(agentId, purpose = 'report') {
  const secret = process.env.MOBILE_UPLOAD_SECRET || process.env.SYNC_SECRET || 'tb-mobile-dev'
  const exp = Date.now() + 3600000
  const raw = `${agentId}:${purpose}:${exp}`
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex').slice(0, 16)
  return {
    token: Buffer.from(`${raw}:${sig}`).toString('base64url'),
    expiresAt: new Date(exp).toISOString(),
    purpose,
  }
}

async function persistUploadToken(agentId, tokenMeta) {
  const db = getFirestore()
  await db.collection('operationalIncidents').add(
    sanitizeFirestoreData({
      incidentType: 'mobile_upload_token',
      agentId,
      tokenExpiresAt: tokenMeta.expiresAt,
      purpose: tokenMeta.purpose,
      createdAt: nowIso(),
    })
  )
}

async function getAgentDispatch(agentId) {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const mine = requests.filter(
    (r) =>
      r.agentId === agentId ||
      (Array.isArray(r.notifiedAgents) && r.notifiedAgents.includes(agentId))
  )
  const enriched = []
  for (const r of mine.slice(0, 15)) {
    const opt = await dispatchOptimization.optimizeDispatch(r, { limit: 3 })
    enriched.push({ request: r, optimization: opt })
  }
  return enriched
}

async function recordMobileTelemetry(agentId, event, metadata = {}) {
  const db = getFirestore()
  await db.collection('operationalIncidents').add(
    sanitizeFirestoreData({
      incidentType: 'mobile_session',
      agentId,
      event,
      metadata,
      createdAt: nowIso(),
    })
  )
}

module.exports = {
  createUploadToken,
  persistUploadToken,
  getAgentDispatch,
  recordMobileTelemetry,
  gpsAttendance,
  liveDispatchTracking,
  offlineSync,
}
