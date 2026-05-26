/**
 * Fraud detection — GPS anomalies, duplicates, rapid movement.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { haversineKm, nowIso, persistInsight, clamp } = require('../ai/_shared')
const COLLECTIONS = require('../ai/autonomousCollections')

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

  const insight = await buildFraudAutomationInsight(agentId, context, alerts)
  return { agentId, alertCount: alerts.length, alerts, insight }
}

async function scanReportIntegrity(report = {}) {
  const signals = []
  const text = [report.notes, report.summary, report.keyFindings].filter(Boolean).join(' ')
  if (text.length < 40) signals.push({ type: 'thin_report', severity: 'low' })
  if (/same as|copy of|duplicate/i.test(text)) signals.push({ type: 'reused_report_text', severity: 'medium' })
  if (report.photoUrls?.length && new Set(report.photoUrls).size < report.photoUrls.length) {
    signals.push({ type: 'repeated_photos', severity: 'high' })
  }
  if (report.voiceNoteUrl && !report.durationSeconds) {
    signals.push({ type: 'suspicious_voice_note', severity: 'medium' })
  }
  return signals
}

function fraudConfidenceScore(alerts = []) {
  if (!alerts.length) return 0
  const weights = { low: 10, medium: 25, high: 45, critical: 70 }
  const sum = alerts.reduce((s, a) => s + (weights[a.severity] || 20), 0)
  return clamp(sum, 0, 100)
}

function recommendedFraudAction(score) {
  if (score >= 70) return 'block_payout_and_review'
  if (score >= 45) return 'hold_payout'
  if (score >= 25) return 'manual_review'
  return 'monitor'
}

async function buildFraudAutomationInsight(agentId, context = {}, alerts = []) {
  const reportSignals = context.report ? await scanReportIntegrity(context.report) : []
  const allAlerts = [...alerts, ...reportSignals]
  const confidence = fraudConfidenceScore(allAlerts)
  const severity =
    confidence >= 70 ? 'critical' : confidence >= 45 ? 'high' : confidence >= 25 ? 'medium' : 'low'

  const insight = {
    agentId,
    requestId: context.requestId || null,
    reportId: context.report?.id || null,
    fraudConfidence: confidence / 100,
    fraudScore: confidence,
    severity,
    signals: allAlerts,
    recommendedAction: recommendedFraudAction(confidence),
    ghostAttendanceRisk: allAlerts.some((a) => a.type === 'duplicate_check_in'),
    fraudulentPayoutRisk: confidence >= 45,
    generatedAt: nowIso(),
    aiProvider: 'rule-based',
  }

  const docId = context.requestId
    ? `${agentId}_${context.requestId}`
    : `${agentId}_${Date.now()}`
  await persistInsight(COLLECTIONS.FRAUD_AUTOMATION_INSIGHTS, docId, insight)
  return insight
}

async function getAgentFraudScore(agentId) {
  const result = await scanAgentActivity(agentId, {})
  return {
    agentId,
    fraudScore: result.insight?.fraudScore ?? 0,
    recommendedAction: result.insight?.recommendedAction ?? 'monitor',
  }
}

async function listFraudAlerts(limit = 40) {
  const db = getFirestore()
  const snap = await db.collection('fraudAlerts').orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

module.exports = {
  createFraudAlert,
  scanAgentActivity,
  scanReportIntegrity,
  buildFraudAutomationInsight,
  getAgentFraudScore,
  fraudConfidenceScore,
  listFraudAlerts,
}
