/**
 * Agent verification workflow — admin approval placeholders.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso } = require('../ai/_shared')

async function getVerification(agentId) {
  const db = getFirestore()
  const doc = await db.collection('agentVerification').doc(agentId).get()
  if (doc.exists) return { agentId, ...doc.data() }
  return {
    agentId,
    status: 'pending',
    idDocumentPlaceholder: true,
    adminApproved: false,
  }
}

async function submitVerification(agentId, payload) {
  const db = getFirestore()
  const data = sanitizeFirestoreData({
    agentId,
    status: 'pending',
    idNumberPlaceholder: payload.idNumberPlaceholder || '',
    documentUploadPlaceholder: true,
    notes: payload.notes || '',
    submittedAt: nowIso(),
    updatedAt: nowIso(),
  })
  await db.collection('agentVerification').doc(agentId).set(data, { merge: true })
  await db.collection('agents').doc(agentId).set(
    { verificationStatus: 'pending', updatedAt: nowIso() },
    { merge: true }
  )
  return data
}

async function adminApprove(agentId, adminUid, approved = true) {
  const db = getFirestore()
  const status = approved ? 'verified' : 'suspended'
  await db.collection('agentVerification').doc(agentId).set(
    {
      status,
      adminApproved: approved,
      reviewedBy: adminUid,
      reviewedAt: nowIso(),
      updatedAt: nowIso(),
    },
    { merge: true }
  )
  await db.collection('agents').doc(agentId).set(
    {
      verificationStatus: status,
      verified: approved,
      updatedAt: nowIso(),
    },
    { merge: true }
  )
  return { agentId, status }
}

async function listPending(limit = 50) {
  const db = getFirestore()
  const snap = await db
    .collection('agentVerification')
    .where('status', '==', 'pending')
    .limit(limit)
    .get()
    .catch(async () => db.collection('agentVerification').limit(limit).get())
  return snap.docs.map((d) => ({ agentId: d.id, ...d.data() }))
}

module.exports = {
  getVerification,
  submitVerification,
  adminApprove,
  listPending,
}
