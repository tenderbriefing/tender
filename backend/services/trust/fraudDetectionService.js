/**
 * Fraud detection — GPS anomalies, duplicates, rapid movement.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { haversineKm, nowIso } = require('../ai/_shared')

async function createFraudAlert(alert) {
  const db = getFirestore()
  const doc = sanitizeFirestoreData({
    ...alert,
    status: 'open',
    createdAt: nowIso(),
  })
  const ref = await db.collection('fraudAlerts').add(doc)
  return { id: ref.id, ...doc }
}

async function scanAgentActivity(agentId, context = {}) {
  const db = getFirestore()
  const alerts = []
  const gpsSnap = await db
    .collection('gpsAttendanceLogs')
    .where('agentId', '==', agentId)
    .limit(30)
    .get()

  const events = gpsSnap.docs.map((d) => d.data())
  const checkIns = events.filter((e) => e.eventType === 'check_in')
  if (checkIns.length > 1 && context.requestId) {
    alerts.push({ type: 'duplicate_check_in', severity: 'medium' })
  }
  const outside = checkIns.filter((e) => e.withinGeofence === false)
  if (outside.length) {
    alerts.push({ type: 'fake_gps_check_in', severity: 'high' })
  }

  if (checkIns.length >= 2) {
    const sorted = [...checkIns].sort(
      (a, b) => new Date(a.serverTimestamp) - new Date(b.serverTimestamp)
    )
    for (let i = 1; i < sorted.length; i++) {
      const km = haversineKm(
        sorted[i - 1].latitude,
        sorted[i - 1].longitude,
        sorted[i].latitude,
        sorted[i].longitude
      )
      const mins =
        (new Date(sorted[i].serverTimestamp) - new Date(sorted[i - 1].serverTimestamp)) / 60000
      if (km != null && km > 80 && mins < 60) {
        alerts.push({ type: 'rapid_multi_location', severity: 'critical', distanceKm: km })
      }
    }
  }

  for (const a of alerts) {
    await createFraudAlert({
      agentId,
      requestId: context.requestId || null,
      alertType: a.type,
      severity: a.severity,
      detail: a,
    })
  }

  return { agentId, alertCount: alerts.length, alerts }
}

async function listFraudAlerts(limit = 40) {
  const db = getFirestore()
  const snap = await db.collection('fraudAlerts').orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

module.exports = { createFraudAlert, scanAgentActivity, listFraudAlerts }
