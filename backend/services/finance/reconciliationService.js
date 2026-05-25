/**
 * Payment and payout reconciliation.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { nowIso } = require('../ai/_shared')

async function reconcilePayments() {
  const storage = require('../storageAdapter').getStorage()
  const requests = await storage.getAttendanceRequests()

  const paid = requests.filter((r) => r.paymentStatus === 'paid')
  const unpaid = requests.filter(
    (r) => r.status !== 'cancelled' && r.paymentStatus !== 'paid' && r.paymentStatus !== 'not_required'
  )
  const failed = requests.filter((r) => r.paymentStatus === 'failed')

  const db = getFirestore()
  let payoutPending = 0
  try {
    const snap = await db.collection('financePayouts').where('status', '==', 'pending').get()
    payoutPending = snap.size
  } catch {
    payoutPending = 0
  }

  return {
    reconciledAt: nowIso(),
    payments: {
      paid: paid.length,
      unpaid: unpaid.length,
      failed: failed.length,
      unpaidRequestIds: unpaid.slice(0, 20).map((r) => r.id),
    },
    payouts: { pending: payoutPending },
    balanced: failed.length === 0,
  }
}

module.exports = { reconcilePayments }
