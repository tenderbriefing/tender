const { randomUUID } = require('crypto')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')

const RUN_COLLECTION = 'automationRuns'
const LEASE_COLLECTION = 'automationLeases'
const LEASE_ID = 'scheduler'
const JSON_STATE_FILE = 'automation-state.json'
const MAX_RUN_RECORDS = 100

const memoryState = {
  lease: null,
  continuations: {},
  runs: [],
}
let jsonMutex = Promise.resolve()

function nowIso(now = Date.now()) {
  return new Date(now).toISOString()
}

function stateAdapter() {
  if (process.env.AUTOMATION_STATE_ADAPTER === 'memory') return 'memory'
  return (process.env.STORAGE_ADAPTER || 'json').toLowerCase() === 'firestore'
    ? 'firestore'
    : 'json'
}

function withJsonMutex(work) {
  const next = jsonMutex.then(work, work)
  jsonMutex = next.catch(() => {})
  return next
}

function readJsonState() {
  const { readCollection } = require('../storageAdapter')
  return readCollection(JSON_STATE_FILE, { lease: null, continuations: {}, runs: [] })
}

function writeJsonState(state) {
  const { writeCollection } = require('../storageAdapter')
  writeCollection(JSON_STATE_FILE, state)
}

async function acquireLease({ ownerId = randomUUID(), now = Date.now(), ttlMs }) {
  const expiresAt = now + ttlMs
  const adapter = stateAdapter()
  if (adapter === 'firestore') {
    const { getFirestore } = require('../../config/firebaseAdmin')
    const db = getFirestore()
    const ref = db.collection(LEASE_COLLECTION).doc(LEASE_ID)
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const current = (snap.exists && snap.data()) || {}
      const currentExpiry = new Date(current.expiresAt || 0).getTime()
      if (current.ownerId && Number.isFinite(currentExpiry) && currentExpiry > now) {
        return { acquired: false, ownerId: current.ownerId, expiresAt: current.expiresAt }
      }
      const lease = {
        ownerId,
        acquiredAt: nowIso(now),
        expiresAt: nowIso(expiresAt),
        takeover: Boolean(current.ownerId),
        continuations: current.continuations || {},
      }
      tx.set(ref, lease, { merge: true })
      return { acquired: true, ...lease }
    })
  }

  const mutate = async (state, save) => {
    const current = state.lease || {}
    const currentExpiry = new Date(current.expiresAt || 0).getTime()
    if (current.ownerId && Number.isFinite(currentExpiry) && currentExpiry > now) {
      return { acquired: false, ownerId: current.ownerId, expiresAt: current.expiresAt }
    }
    const lease = {
      ownerId,
      acquiredAt: nowIso(now),
      expiresAt: nowIso(expiresAt),
      takeover: Boolean(current.ownerId),
      continuations: state.continuations || {},
    }
    state.lease = lease
    save(state)
    return { acquired: true, ...lease }
  }
  if (adapter === 'memory') return mutate(memoryState, () => {})
  return withJsonMutex(async () => mutate(readJsonState(), writeJsonState))
}

async function releaseLease({ ownerId, continuations = {}, now = Date.now(), keepUntilExpiry = false }) {
  const adapter = stateAdapter()
  if (adapter === 'firestore') {
    const { getFirestore } = require('../../config/firebaseAdmin')
    const db = getFirestore()
    const ref = db.collection(LEASE_COLLECTION).doc(LEASE_ID)
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const current = (snap.exists && snap.data()) || {}
      if (current.ownerId !== ownerId) return false
      tx.set(ref, sanitizeFirestoreData({
        ownerId: keepUntilExpiry ? ownerId : null,
        releasedAt: keepUntilExpiry ? null : nowIso(now),
        expiresAt: keepUntilExpiry ? current.expiresAt : nowIso(now),
        continuations,
      }), { merge: true })
      return true
    })
  }
  const mutate = async (state, save) => {
    if (state.lease?.ownerId !== ownerId) return false
    state.continuations = continuations
    state.lease = {
      ...state.lease,
      ownerId: keepUntilExpiry ? ownerId : null,
      releasedAt: keepUntilExpiry ? null : nowIso(now),
      expiresAt: keepUntilExpiry ? state.lease.expiresAt : nowIso(now),
    }
    save(state)
    return true
  }
  if (adapter === 'memory') return mutate(memoryState, () => {})
  return withJsonMutex(async () => mutate(readJsonState(), writeJsonState))
}

async function saveRun(run) {
  const record = sanitizeFirestoreData(run)
  const adapter = stateAdapter()
  if (adapter === 'firestore') {
    const { getFirestore } = require('../../config/firebaseAdmin')
    await getFirestore().collection(RUN_COLLECTION).doc(run.runId).set(record, { merge: true })
    return record
  }
  const mutate = async (state, save) => {
    const runs = Array.isArray(state.runs) ? state.runs : []
    const index = runs.findIndex((entry) => entry.runId === run.runId)
    if (index >= 0) runs[index] = record
    else runs.unshift(record)
    state.runs = runs.slice(0, MAX_RUN_RECORDS)
    save(state)
    return record
  }
  if (adapter === 'memory') return mutate(memoryState, () => {})
  return withJsonMutex(async () => mutate(readJsonState(), writeJsonState))
}

async function getOperationalState({ limit = 20 } = {}) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100))
  const adapter = stateAdapter()
  if (adapter === 'firestore') {
    const { getFirestore } = require('../../config/firebaseAdmin')
    const db = getFirestore()
    const [leaseSnap, runsSnap] = await Promise.all([
      db.collection(LEASE_COLLECTION).doc(LEASE_ID).get(),
      db.collection(RUN_COLLECTION).orderBy('startedAt', 'desc').limit(boundedLimit).get(),
    ])
    return {
      lease: leaseSnap.exists ? leaseSnap.data() : null,
      runs: runsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    }
  }
  const state = adapter === 'memory' ? memoryState : readJsonState()
  return { lease: state.lease || null, runs: (state.runs || []).slice(0, boundedLimit) }
}

function resetMemoryState() {
  memoryState.lease = null
  memoryState.continuations = {}
  memoryState.runs = []
}

module.exports = {
  RUN_COLLECTION,
  LEASE_COLLECTION,
  LEASE_ID,
  MAX_RUN_RECORDS,
  stateAdapter,
  acquireLease,
  releaseLease,
  saveRun,
  getOperationalState,
  resetMemoryState,
}
