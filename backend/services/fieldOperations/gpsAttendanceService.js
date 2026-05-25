/**
 * GPS check-in/check-out with geofence validation.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { haversineKm, nowIso } = require('../ai/_shared')

const DEFAULT_GEOFENCE_KM = Number(process.env.PILOT_GEOFENCE_KM || 2)

async function recordGpsEvent(payload) {
  const db = getFirestore()
  const timestamp = nowIso()
  const siteLat = payload.siteLatitude
  const siteLng = payload.siteLongitude
  const lat = payload.latitude
  const lng = payload.longitude
  const distanceKm =
    siteLat != null && siteLng != null ? haversineKm(lat, lng, siteLat, siteLng) : null
  const geofenceKm = payload.geofenceKm ?? DEFAULT_GEOFENCE_KM
  const withinGeofence = distanceKm != null ? distanceKm <= geofenceKm : null

  const log = sanitizeFirestoreData({
    requestId: payload.requestId,
    agentId: payload.agentId,
    eventType: payload.eventType || 'check_in',
    latitude: lat,
    longitude: lng,
    siteLatitude: siteLat,
    siteLongitude: siteLng,
    distanceKm,
    withinGeofence,
    geofenceKm,
    deviceTimestamp: payload.deviceTimestamp || timestamp,
    serverTimestamp: timestamp,
    selfiePlaceholder: Boolean(payload.selfiePlaceholder),
    notes: payload.notes || '',
  })

  const ref = await db.collection('gpsAttendanceLogs').add(log)
  return { id: ref.id, ...log }
}

async function validateCheckIn(agentId, requestId) {
  const db = getFirestore()
  const snap = await db
    .collection('gpsAttendanceLogs')
    .where('agentId', '==', agentId)
    .where('requestId', '==', requestId)
    .limit(20)
    .get()

  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const checkIn = events.find((e) => e.eventType === 'check_in')
  const checkOut = events.find((e) => e.eventType === 'check_out')

  return {
    valid: Boolean(checkIn?.withinGeofence),
    checkIn,
    checkOut,
    duplicateCheckIns: events.filter((e) => e.eventType === 'check_in').length > 1,
  }
}

module.exports = {
  DEFAULT_GEOFENCE_KM,
  recordGpsEvent,
  validateCheckIn,
}
