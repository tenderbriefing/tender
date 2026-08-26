/**
 * Durable private tender audit events (Phase 2) — Admin SDK only.
 * Does not store secrets or full document payloads.
 */
const crypto = require('crypto')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const COLLECTION = 'privateTenderAuditEvents'

function getDb(deps = {}) {
  if (deps.db) return deps.db
  const { getFirestore } = require('../config/firebaseAdmin')
  return getFirestore()
}

function nowIso(now) {
  return (now || new Date()).toISOString()
}

function safeMetadata(meta) {
  if (!meta || typeof meta !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(meta)) {
    if (key.toLowerCase().includes('token')) continue
    if (key.toLowerCase().includes('password')) continue
    if (key.toLowerCase().includes('secret')) continue
    if (typeof value === 'string') out[key] = value.slice(0, 500)
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
    else if (value == null) out[key] = null
    else out[key] = String(value).slice(0, 200)
  }
  return out
}

async function writeAuditEvent(event, deps = {}) {
  const db = getDb(deps)
  const ts = nowIso(event.createdAt || deps.now)
  const id = event.id || `ptae-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
  const record = sanitizeFirestoreData({
    id,
    submissionId: event.submissionId || null,
    organisationId: event.organisationId || null,
    actorUid: event.actorUid || null,
    actorType: event.actorType || 'system',
    eventType: event.eventType,
    fromStatus: event.fromStatus || null,
    toStatus: event.toStatus || null,
    metadata: safeMetadata(event.metadata),
    createdAt: ts,
  })
  try {
    await db.collection(COLLECTION).doc(id).set(record)
  } catch {
    /* fail-soft — never block business transitions */
  }
  return record
}

async function listAuditEvents(submissionId, deps = {}) {
  const db = getDb(deps)
  const snap = await db
    .collection(COLLECTION)
    .where('submissionId', '==', String(submissionId))
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

module.exports = {
  COLLECTION,
  writeAuditEvent,
  listAuditEvents,
  safeMetadata,
}
