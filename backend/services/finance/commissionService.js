/**
 * Platform commission and agent earnings.
 */
const ATTENDANCE_FEE_CENTS = Number(process.env.NEXT_PUBLIC_ATTENDANCE_FEE_CENTS || 24900)
const PLATFORM_RATE = Number(process.env.PLATFORM_COMMISSION_RATE || 0.35)

async function calculateAgentEarnings(agentId, requestIds = []) {
  const storage = require('../storageAdapter').getStorage()
  const requests = await storage.getAttendanceRequests()
  const paid = requests.filter(
    (r) =>
      r.paymentStatus === 'paid' &&
      (requestIds.length === 0 || requestIds.includes(r.id)) &&
      (r.agentId === agentId || requestIds.includes(r.id))
  )

  const grossCents = paid.reduce((s, r) => s + (r.paymentAmount || ATTENDANCE_FEE_CENTS), 0)
  const platformCommissionCents = Math.round(grossCents * PLATFORM_RATE)
  const agentEarningsCents = grossCents - platformCommissionCents

  return {
    agentId,
    completedAssignments: paid.length,
    grossCents,
    platformCommissionCents,
    agentEarningsCents,
    platformRate: PLATFORM_RATE,
  }
}

async function getCommissionSummary() {
  const storage = require('../storageAdapter').getStorage()
  const requests = await storage.getAttendanceRequests()
  const paid = requests.filter((r) => r.paymentStatus === 'paid')
  const gross = paid.reduce((s, r) => s + (r.paymentAmount || ATTENDANCE_FEE_CENTS), 0)
  const platform = Math.round(gross * PLATFORM_RATE)
  return {
    paidRequests: paid.length,
    grossCents: gross,
    platformCommissionCents: platform,
    agentPoolCents: gross - platform,
  }
}

module.exports = { calculateAgentEarnings, getCommissionSummary, PLATFORM_RATE }
