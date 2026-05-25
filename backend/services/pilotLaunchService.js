/**
 * Pilot launch metrics — real Firestore counts for commercial readiness tracking.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { getStorage } = require('./storageAdapter')
const whatsappService = require('./whatsappService')

const TARGETS = {
  smes: 10,
  agents: 20,
  briefingRequests: 50,
}

async function collectionCount(db, collectionRef) {
  try {
    const snap = await collectionRef.count().get()
    return snap.data().count || 0
  } catch {
    const snap = await collectionRef.limit(5000).get()
    return snap.size
  }
}

async function countOnboarded(db, collectionName) {
  try {
    const snap = await db
      .collection(collectionName)
      .where('onboardingCompleted', '==', true)
      .count()
      .get()
    return snap.data().count || 0
  } catch {
    const snap = await db
      .collection(collectionName)
      .where('onboardingCompleted', '==', true)
      .limit(5000)
      .get()
    return snap.size
  }
}

function pct(current, target) {
  if (!target) return 0
  return Math.min(100, Math.round((current / target) * 1000) / 10)
}

async function getPilotLaunchMetrics() {
  const db = getFirestore()
  const storage = getStorage()

  const [
    totalSmes,
    totalAgents,
    onboardedSmes,
    onboardedAgents,
    requests,
    reports,
    waStats,
  ] = await Promise.all([
    collectionCount(db, db.collection('smes')),
    collectionCount(db, db.collection('agents')),
    countOnboarded(db, 'smes'),
    countOnboarded(db, 'agents'),
    storage.getAttendanceRequests(),
    storage.getBriefingReports(),
    whatsappService.getWhatsAppStats(50),
  ])

  const activeRequests = requests.filter((r) =>
    ['pending', 'accepted', 'in_progress'].includes(r.status)
  ).length

  const completedReports = reports.length
  const completedRequests = requests.filter((r) => r.status === 'completed').length

  const paidRequests = requests.filter((r) => r.paymentStatus === 'paid')
  const dispatched = paidRequests.filter((r) => r.agentId || r.acceptedAt)
  const dispatchSuccessRate =
    paidRequests.length > 0
      ? Math.round((dispatched.length / paidRequests.length) * 1000) / 10
      : null

  const waTotal = (waStats.sent || 0) + (waStats.failed || 0) + (waStats.pending || 0)
  const whatsappHealthPct =
    waTotal > 0 ? Math.round((waStats.sent / waTotal) * 1000) / 10 : null

  return {
    capturedAt: new Date().toISOString(),
    targets: TARGETS,
    progress: {
      smes: {
        current: totalSmes,
        onboarded: onboardedSmes,
        target: TARGETS.smes,
        pct: pct(totalSmes, TARGETS.smes),
        onboardedPct: pct(onboardedSmes, TARGETS.smes),
      },
      agents: {
        current: totalAgents,
        onboarded: onboardedAgents,
        target: TARGETS.agents,
        pct: pct(totalAgents, TARGETS.agents),
        onboardedPct: pct(onboardedAgents, TARGETS.agents),
      },
      briefingRequests: {
        current: requests.length,
        target: TARGETS.briefingRequests,
        pct: pct(requests.length, TARGETS.briefingRequests),
      },
    },
    operations: {
      activeRequests,
      completedRequests,
      completedReports,
      paidRequests: paidRequests.length,
      dispatchSuccessRate,
      whatsapp: {
        configured: whatsappService.isConfigured(),
        sent: waStats.sent,
        failed: waStats.failed,
        pending: waStats.pending,
        healthPct: whatsappHealthPct,
      },
    },
    pilotReady:
      totalSmes >= TARGETS.smes &&
      totalAgents >= TARGETS.agents &&
      requests.length >= TARGETS.briefingRequests,
  }
}

module.exports = {
  TARGETS,
  getPilotLaunchMetrics,
  countOnboarded,
}
