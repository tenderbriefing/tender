/**
 * Phase 19 — SME Connect recommendation persistence (no customer notify).
 */
const COLLECTION = 'smeConnectRecommendations'

function storage() {
  const { getStorage } = require('./storageAdapter')
  return getStorage()
}

async function listRecommendations({ status, limit = 200 } = {}) {
  const s = storage()
  if (typeof s.listCollectionDocs === 'function') {
    const rows = await s.listCollectionDocs(COLLECTION, { limit: Math.min(limit, 500) })
    return (rows || []).filter((r) => !status || r.status === status)
  }
  const state = await s.getSyncState()
  const all = Array.isArray(state.smeConnectRecommendations) ? state.smeConnectRecommendations : []
  return all.filter((r) => !status || r.status === status).slice(0, limit)
}

async function upsertRecommendation(rec) {
  const id =
    rec.id ||
    `sme-rec-${rec.smeId || 'sme'}-${rec.tenderId || rec.tenderNumber || Date.now()}`
  const row = {
    ...rec,
    id,
    // Preserve explicit notify flag after controlled outreach send
    customerNotified: rec.customerNotified === true,
    updatedAt: new Date().toISOString(),
    createdAt: rec.createdAt || new Date().toISOString(),
  }
  const s = storage()
  if (typeof s.upsertCollectionDoc === 'function') {
    await s.upsertCollectionDoc(COLLECTION, id, row)
    return row
  }
  const state = await s.getSyncState()
  const all = Array.isArray(state.smeConnectRecommendations) ? state.smeConnectRecommendations : []
  const idx = all.findIndex((x) => x.id === id)
  if (idx >= 0) all[idx] = row
  else all.unshift(row)
  state.smeConnectRecommendations = all.slice(0, 2000)
  await s.saveSyncState(state)
  return row
}

async function getRecommendation(id) {
  const all = await listRecommendations({ limit: 2000 })
  return all.find((r) => r.id === id) || null
}

module.exports = {
  COLLECTION,
  listRecommendations,
  upsertRecommendation,
  getRecommendation,
}
