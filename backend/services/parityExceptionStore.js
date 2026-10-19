/**
 * Phase 19 — durable parity exception queue.
 */
const COLLECTION = 'parityExceptions'

function storage() {
  const { getStorage } = require('./storageAdapter')
  return getStorage()
}

async function listExceptions({ category, limit = 200, status = 'OPEN' } = {}) {
  const s = storage()
  if (typeof s.listCollectionDocs === 'function') {
    const rows = await s.listCollectionDocs(COLLECTION, { limit: Math.min(limit, 500) })
    return (rows || []).filter((r) => {
      if (status && r.status !== status) return false
      if (category && r.category !== category) return false
      return true
    })
  }
  // JSON fallback via sync state
  const state = await s.getSyncState()
  const all = Array.isArray(state.parityExceptions) ? state.parityExceptions : []
  return all
    .filter((r) => (!status || r.status === status) && (!category || r.category === category))
    .slice(0, limit)
}

async function upsertException(exception) {
  const id =
    exception.id ||
    `${exception.category || 'exc'}-${exception.date || 'na'}-${exception.tenderNumber || exception.ocid || Date.now()}`
  const row = {
    ...exception,
    id,
    status: exception.status || 'OPEN',
    updatedAt: new Date().toISOString(),
    createdAt: exception.createdAt || new Date().toISOString(),
  }

  const s = storage()
  if (typeof s.upsertCollectionDoc === 'function') {
    await s.upsertCollectionDoc(COLLECTION, id, row)
    return row
  }

  const state = await s.getSyncState()
  const all = Array.isArray(state.parityExceptions) ? state.parityExceptions : []
  const idx = all.findIndex((x) => x.id === id)
  if (idx >= 0) all[idx] = row
  else all.unshift(row)
  state.parityExceptions = all.slice(0, 2000)
  await s.saveSyncState(state)
  return row
}

async function resolveException(id, resolution = {}) {
  const open = await listExceptions({ status: null, limit: 2000 })
  const existing = open.find((x) => x.id === id)
  if (!existing) return null
  return upsertException({
    ...existing,
    status: 'RESOLVED',
    resolvedAt: new Date().toISOString(),
    resolution,
  })
}

module.exports = {
  COLLECTION,
  listExceptions,
  upsertException,
  resolveException,
}
