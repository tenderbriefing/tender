/**
 * AI dispatch optimization — agent selection, ETA, workload, escalation prediction.
 */
const liveDispatch = require('../liveDispatchService')
const { getFirestore } = require('../../config/firebaseAdmin')
const { clamp } = require('./_shared')

function predictEtaMinutes(distanceKm, tier) {
  if (distanceKm == null) return 90
  const speedKmH = tier === 'Platinum' ? 55 : tier === 'Gold' ? 45 : 35
  return Math.max(15, Math.round((distanceKm / speedKmH) * 60 + 20))
}

async function optimizeDispatch(request, options = {}) {
  const agents = await liveDispatch.findBestAgentsForRequest(request, {
    limit: options.limit || 5,
  })

  const db = getFirestore()
  const activeSnap = await db
    .collection('attendanceRequests')
    .where('status', 'in', ['accepted', 'in_progress'])
    .limit(200)
    .get()
    .catch(() => ({ docs: [] }))

  const workloadByAgent = {}
  for (const doc of activeSnap.docs || []) {
    const aid = doc.data().agentId
    if (aid) workloadByAgent[aid] = (workloadByAgent[aid] || 0) + 1
  }

  const optimized = agents.map((a) => {
    const workload = workloadByAgent[a.agentId] || 0
    const etaMinutes = predictEtaMinutes(a.distanceKm, a.tier)
    const escalationRisk =
      (request.slaEscalated ? 80 : 0) +
      (etaMinutes > 120 ? 30 : 0) +
      workload * 10

    return {
      ...a,
      etaMinutes,
      activeWorkload: workload,
      escalationRisk: clamp(escalationRisk, 0, 100),
      recommended: a === agents[0],
    }
  })

  return {
    requestId: request.id,
    optimalAgent: optimized[0] || null,
    candidates: optimized,
    workloadBalancing: workloadByAgent,
    predictedEscalation: optimized[0]?.escalationRisk >= 60,
  }
}

module.exports = { optimizeDispatch, predictEtaMinutes }
