/**
 * Agent payout batches and statuses.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso } = require('../ai/_shared')
const commissionService = require('./commissionService')

async function createPayoutBatch(agentId, requestIds = []) {
  const db = getFirestore()
  const calc = await commissionService.calculateAgentEarnings(agentId, requestIds)
  const batch = sanitizeFirestoreData({
    agentId,
    requestIds,
    amountCents: calc.agentEarningsCents,
    platformCommissionCents: calc.platformCommissionCents,
    status: 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })
  const ref = await db.collection('financePayouts').add(batch)
  await db.collection('financeTransactions').add(
    sanitizeFirestoreData({
      type: 'payout',
      payoutId: ref.id,
      agentId,
      amountCents: calc.agentEarningsCents,
      status: 'pending',
      createdAt: nowIso(),
    })
  )
  return { id: ref.id, ...batch }
}

async function updatePayoutStatus(payoutId, status) {
  const db = getFirestore()
  const allowed = ['pending', 'processing', 'paid', 'failed', 'cancelled']
  if (!allowed.includes(status)) throw new Error('Invalid payout status')
  await db.collection('financePayouts').doc(payoutId).set(
    { status, updatedAt: nowIso() },
    { merge: true }
  )
  return { id: payoutId, status }
}

async function listPayouts(limit = 50) {
  const db = getFirestore()
  const snap = await db.collection('financePayouts').orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

module.exports = { createPayoutBatch, updatePayoutStatus, listPayouts }
