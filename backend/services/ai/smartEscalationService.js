/**
 * AI smart escalation — value, compulsory briefing, no-show, VIP priority.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso, clamp } = require('./_shared')
const COLLECTIONS = require('./autonomousCollections')

const LEVELS = ['nearby_agents', 'province_wide', 'admin_escalation', 'emergency_dispatch']

function escalationPriority(request, context = {}) {
  let priority = 50
  if (request.briefingCompulsory || request.compulsoryBriefing) priority += 20
  if (request.paymentAmount >= 1500 || request.quotedFee >= 1500) priority += 15
  if (context.noShowRisk >= 60) priority += 25
  if (context.vipAccount) priority += 20
  if (request.slaEscalated) priority += 10
  return clamp(priority, 0, 100)
}

function minutesForLevel(priority) {
  if (priority >= 85) return { initial: 5, radius: 10, province: 20, admin: 40 }
  if (priority >= 65) return { initial: 8, radius: 12, province: 25, admin: 50 }
  return { initial: 15, radius: 15, province: 30, admin: 60 }
}

async function logEscalation(patch) {
  const db = getFirestore()
  const id = patch.id || `esc-${patch.requestId}-${patch.level}-${Date.now()}`
  const doc = sanitizeFirestoreData({ ...patch, id, createdAt: nowIso() })
  await db.collection(COLLECTIONS.WORKFLOW_ESCALATIONS).doc(id).set(doc, { merge: true })
  return doc
}

async function evaluateEscalation(request, context = {}) {
  const priority = escalationPriority(request, context)
  const thresholds = minutesForLevel(priority)
  const paidAt = new Date(request.paidAt || request.createdAt || 0).getTime()
  const minutesWaiting = paidAt ? (Date.now() - paidAt) / 60000 : 0

  let level = null
  let action = 'monitor'
  if (minutesWaiting >= thresholds.admin) {
    level = 'admin_escalation'
    action = 'notify_admin'
  } else if (minutesWaiting >= thresholds.province) {
    level = 'province_wide'
    action = 'province_dispatch'
  } else if (minutesWaiting >= thresholds.radius) {
    level = 'nearby_agents'
    action = 'widen_radius'
  } else if (minutesWaiting >= thresholds.initial && !request.lastDispatchAt) {
    level = 'nearby_agents'
    action = 'initial_dispatch'
  }

  if (priority >= 90 && minutesWaiting >= thresholds.radius / 2) {
    level = 'emergency_dispatch'
    action = 'emergency_dispatch'
  }

  const result = {
    requestId: request.id,
    priority,
    level,
    action,
    thresholds,
    minutesWaiting: Math.round(minutesWaiting),
    evaluatedAt: nowIso(),
  }

  if (level) {
    await logEscalation({
      requestId: request.id,
      level,
      priority,
      action,
      smeId: request.smeId,
      province: request.province,
    })
  }
  return result
}

async function runSmartEscalations() {
  const { getStorage } = require('../storageAdapter')
  const liveDispatch = require('../liveDispatchService')
  const noShow = require('./noShowPredictionService')
  const workflow = require('../workflowAutomationService')
  const requests = await getStorage().getAttendanceRequests()

  let escalated = 0
  for (const request of requests) {
    if (request.status !== 'pending' || request.paymentStatus !== 'paid') continue
    let noShowRisk = 0
    try {
      const pred = await noShow.predictNoShow(request)
      noShowRisk = pred.riskScore || 0
    } catch {
      /* optional */
    }
    const ev = await evaluateEscalation(request, {
      noShowRisk,
      vipAccount: request.enterpriseAccount === true,
    })
    if (!ev.level) continue

    if (ev.action === 'province_dispatch' || ev.action === 'emergency_dispatch') {
      await liveDispatch.autoDispatchRequest(request, {
        radiusKm: ev.action === 'emergency_dispatch' ? 250 : 200,
        provinceWide: true,
        reason: ev.level,
      })
      escalated += 1
    } else if (ev.action === 'widen_radius' || ev.action === 'initial_dispatch') {
      await liveDispatch.autoDispatchRequest(request, {
        radiusKm: ev.priority >= 75 ? 80 : 50,
        reason: ev.level,
      })
      escalated += 1
    } else if (ev.action === 'notify_admin') {
      await workflow.dispatchWorkflowEvent('attendance_requested', {
        ...request,
        id: request.id,
        requestId: request.id,
        slaEscalation: ev.level,
        idempotencySuffix: `smart-esc-${ev.level}`,
      })
      escalated += 1
    }
  }
  return { job: 'smart_escalation', escalated, scanned: requests.length }
}

module.exports = {
  escalationPriority,
  evaluateEscalation,
  runSmartEscalations,
  logEscalation,
  LEVELS,
  COLLECTION: COLLECTIONS.WORKFLOW_ESCALATIONS,
}
