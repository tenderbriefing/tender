/**
 * Organisation memberships (Phase 2) — Admin SDK only.
 */
const crypto = require('crypto')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const COLLECTION = 'privateOrganisationMembers'
const ROLES = new Set(['owner', 'admin', 'procurement'])
const STATUSES = new Set(['active', 'invited', 'disabled'])

function getDb(deps = {}) {
  if (deps.db) return deps.db
  const { getFirestore } = require('../config/firebaseAdmin')
  return getFirestore()
}

function nowIso(now) {
  return (now || new Date()).toISOString()
}

function sliceStr(value, max) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function normalizeEmail(email) {
  return sliceStr(email, 320).toLowerCase()
}

function membershipId(organisationId, uid) {
  return `pom-${organisationId}-${uid}`
}

async function createMembership(input, meta = {}, deps = {}) {
  const db = getDb(deps)
  const organisationId = sliceStr(input.organisationId, 80)
  const uid = sliceStr(input.uid, 128)
  const email = normalizeEmail(input.email)
  const role = ROLES.has(input.role) ? input.role : 'procurement'
  const status = STATUSES.has(input.status) ? input.status : 'active'
  if (!organisationId || !uid || !email) {
    const err = new Error('organisationId, uid, and email are required')
    err.status = 400
    throw err
  }
  const id = input.id || membershipId(organisationId, uid)
  const ts = nowIso(meta.now)
  const record = sanitizeFirestoreData({
    id,
    organisationId,
    uid,
    email,
    role,
    status,
    invitedByUid: meta.invitedByUid || null,
    createdAt: ts,
    updatedAt: ts,
  })
  await db.collection(COLLECTION).doc(id).set(record, { merge: true })
  return record
}

async function getMembershipById(id, deps = {}) {
  const db = getDb(deps)
  const snap = await db.collection(COLLECTION).doc(String(id)).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() }
}

async function getActiveMembershipForUser(uid, deps = {}) {
  if (!uid) return null
  const db = getDb(deps)
  const snap = await db
    .collection(COLLECTION)
    .where('uid', '==', String(uid))
    .where('status', '==', 'active')
    .limit(5)
    .get()
  if (snap.empty) return null
  // Prefer owner, then admin, then first active
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  items.sort((a, b) => {
    const rank = { owner: 0, admin: 1, procurement: 2 }
    return (rank[a.role] ?? 9) - (rank[b.role] ?? 9)
  })
  return items[0]
}

async function getMembership(organisationId, uid, deps = {}) {
  if (!organisationId || !uid) return null
  const db = getDb(deps)
  const id = membershipId(organisationId, uid)
  const byId = await getMembershipById(id, deps)
  if (byId) return byId
  const snap = await db
    .collection(COLLECTION)
    .where('organisationId', '==', String(organisationId))
    .where('uid', '==', String(uid))
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() }
}

async function listMembers(organisationId, deps = {}) {
  const db = getDb(deps)
  const snap = await db
    .collection(COLLECTION)
    .where('organisationId', '==', String(organisationId))
    .limit(100)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function inviteMember(organisationId, { email, role }, meta = {}, deps = {}) {
  const db = getDb(deps)
  const normalized = normalizeEmail(email)
  if (!normalized) {
    const err = new Error('email is required')
    err.status = 400
    throw err
  }
  const memberRole = ROLES.has(role) ? role : 'procurement'
  if (memberRole === 'owner') {
    const err = new Error('Cannot invite a second owner via invite; transfer is out of scope')
    err.status = 400
    throw err
  }

  // Resolve existing Auth user by email when possible; otherwise create invited placeholder uid.
  let uid = null
  try {
    const { getFirebaseAdmin } = require('../config/firebaseAdmin')
    const admin = getFirebaseAdmin()
    const user = await admin.auth().getUserByEmail(normalized)
    uid = user.uid
  } catch {
    uid = `invited-${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24)}`
  }

  const existing = await getMembership(organisationId, uid, deps)
  if (existing && existing.status === 'active') {
    return { membership: existing, created: false }
  }

  const membership = await createMembership(
    {
      organisationId,
      uid,
      email: normalized,
      role: memberRole,
      status: uid.startsWith('invited-') ? 'invited' : 'active',
    },
    { invitedByUid: meta.invitedByUid || null, now: meta.now },
    deps
  )
  return { membership, created: true }
}

async function updateMembership(id, patch, meta = {}, deps = {}) {
  const db = getDb(deps)
  const ref = db.collection(COLLECTION).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) {
    const err = new Error('Membership not found')
    err.status = 404
    throw err
  }
  const current = snap.data() || {}
  const next = { ...current }
  if (patch.role !== undefined) {
    if (!ROLES.has(patch.role)) {
      const err = new Error('Invalid role')
      err.status = 400
      throw err
    }
    if (current.role === 'owner' && patch.role !== 'owner') {
      const err = new Error('Owner role cannot be demoted in Phase 2')
      err.status = 400
      throw err
    }
    if (patch.role === 'owner' && current.role !== 'owner') {
      const err = new Error('Owner role transfer is out of scope for Phase 2')
      err.status = 400
      throw err
    }
    next.role = patch.role
  }
  if (patch.status !== undefined) {
    if (!STATUSES.has(patch.status)) {
      const err = new Error('Invalid status')
      err.status = 400
      throw err
    }
    if (current.role === 'owner' && patch.status === 'disabled') {
      const err = new Error('Owner membership cannot be disabled')
      err.status = 400
      throw err
    }
    next.status = patch.status
  }
  next.updatedAt = nowIso(meta.now)
  const cleaned = sanitizeFirestoreData(next)
  await ref.set(cleaned, { merge: true })
  return { id, ...cleaned }
}

function memberHasPermission(member, permission) {
  if (!member || member.status !== 'active') return false
  const map = {
    owner: [
      'manage_profile',
      'manage_members',
      'create_tender',
      'edit_tender',
      'submit_tender',
      'withdraw_tender',
      'duplicate_tender',
      'view_tenders',
      'destructive_org',
    ],
    admin: [
      'manage_profile',
      'manage_members',
      'create_tender',
      'edit_tender',
      'submit_tender',
      'withdraw_tender',
      'duplicate_tender',
      'view_tenders',
    ],
    procurement: [
      'create_tender',
      'edit_tender',
      'submit_tender',
      'withdraw_tender',
      'duplicate_tender',
      'view_tenders',
    ],
  }
  return (map[member.role] || []).includes(permission)
}

module.exports = {
  COLLECTION,
  membershipId,
  createMembership,
  getMembershipById,
  getActiveMembershipForUser,
  getMembership,
  listMembers,
  inviteMember,
  updateMembership,
  memberHasPermission,
}
