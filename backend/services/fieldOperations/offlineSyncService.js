/**
 * Offline sync queue — reports, check-ins, voice notes (mobile-ready).
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso } = require('../ai/_shared')

async function enqueueOfflineItem(payload) {
  const db = getFirestore()
  const item = sanitizeFirestoreData({
    agentId: payload.agentId,
    itemType: payload.itemType || 'report',
    payload: payload.data || {},
    status: 'queued',
    clientTimestamp: payload.clientTimestamp || nowIso(),
    createdAt: nowIso(),
  })
  const ref = await db.collection('operationalIncidents').add({
    ...item,
    incidentType: 'offline_sync_queue',
  })
  return { id: ref.id, ...item }
}

async function processOfflineQueue(agentId, limit = 20) {
  const db = getFirestore()
  const snap = await db
    .collection('operationalIncidents')
    .where('incidentType', '==', 'offline_sync_queue')
    .where('agentId', '==', agentId)
    .where('status', '==', 'queued')
    .limit(limit)
    .get()
    .catch(async () => {
      const fallback = await db
        .collection('operationalIncidents')
        .where('incidentType', '==', 'offline_sync_queue')
        .limit(limit)
        .get()
      return fallback
    })

  const processed = []
  for (const doc of snap.docs) {
    await doc.ref.set({ status: 'synced', syncedAt: nowIso() }, { merge: true })
    processed.push(doc.id)
  }
  return { processed, count: processed.length }
}

module.exports = { enqueueOfflineItem, processOfflineQueue }
