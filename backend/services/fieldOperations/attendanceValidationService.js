/**
 * Field attendance validation — GPS, timestamps, duplicates, selfie placeholder.
 */
const gpsAttendance = require('./gpsAttendanceService')
const { getFirestore } = require('../../config/firebaseAdmin')
const fraudDetection = require('../trust/fraudDetectionService')

async function validateAttendance(payload) {
  const { agentId, requestId, selfieUploaded } = payload
  const gps = await gpsAttendance.validateCheckIn(agentId, requestId)

  const db = getFirestore()
  const dupSnap = await db
    .collection('gpsAttendanceLogs')
    .where('agentId', '==', agentId)
    .where('eventType', '==', 'check_in')
    .limit(50)
    .get()

  const duplicateAttendance = dupSnap.size > 3

  const issues = []
  if (!gps.checkIn) issues.push('missing_check_in')
  if (gps.checkIn && gps.checkIn.withinGeofence === false) issues.push('outside_geofence')
  if (gps.duplicateCheckIns) issues.push('duplicate_check_in')
  if (!selfieUploaded) issues.push('selfie_placeholder_missing')
  if (duplicateAttendance) issues.push('excessive_check_ins')

  const fraudSignals = await fraudDetection.scanAgentActivity(agentId, { requestId })

  return {
    valid: issues.length === 0 && gps.valid,
    issues,
    gps,
    fraudSignals,
    validatedAt: new Date().toISOString(),
  }
}

module.exports = { validateAttendance }
