const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const notificationService = require('./notificationService')

const COLLECTION = 'smeWorkspace'

function slugify(value) {
  return (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown'
  )
}

function tenderSnapshot(tender) {
  return sanitizeFirestoreData({
    tenderId: tender.id,
    tenderNumber: tender.tenderNumber || '',
    title: tender.title || '',
    department: tender.department || '',
    province: tender.province || '',
    category: tender.category || tender.industrySector || '',
    closingDate: tender.closingDate || '',
    briefingDate: tender.briefingDate || '',
    briefingVenue: tender.briefingVenue || '',
    briefingCompulsory: tender.briefingCompulsory === true,
    createdAt: new Date().toISOString(),
  })
}

function emptyWorkspace(userId) {
  return {
    userId,
    trackedTenderIds: [],
    savedTenderIds: [],
    watchedDepartments: [],
    watchedProvinces: [],
    updatedAt: new Date().toISOString(),
  }
}

async function getWorkspaceDoc(userId) {
  const db = getFirestore()
  const ref = db.collection(COLLECTION).doc(userId)
  const snap = await ref.get()
  if (!snap.exists) return emptyWorkspace(userId)
  return { ...emptyWorkspace(userId), ...snap.data() }
}

async function saveWorkspaceDoc(userId, patch) {
  const db = getFirestore()
  const payload = sanitizeFirestoreData({
    ...patch,
    userId,
    updatedAt: new Date().toISOString(),
  })
  await db.collection(COLLECTION).doc(userId).set(payload, { merge: true })
  return payload
}

async function addTenderEntry(userId, subcollection, tenderId, tender) {
  const db = getFirestore()
  const workspaceRef = db.collection(COLLECTION).doc(userId)
  const entryRef = workspaceRef.collection(subcollection).doc(tenderId)
  const existing = await entryRef.get()
  if (existing.exists) {
    const workspace = await getWorkspaceDoc(userId)
    return { workspace, created: false }
  }

  const snapshot = tenderSnapshot(tender)
  await entryRef.set(snapshot)

  const workspace = await getWorkspaceDoc(userId)
  const idField =
    subcollection === 'savedTenders' ? 'savedTenderIds' : 'trackedTenderIds'
  const ids = new Set(workspace[idField] || [])
  ids.add(tenderId)
  const updated = await saveWorkspaceDoc(userId, { [idField]: Array.from(ids) })

  const eventType =
    subcollection === 'savedTenders' ? 'sme_saved_tender' : 'sme_tracked_tender'
  await notificationService.notify(eventType, {
    smeId: userId,
    tenderId,
    tenderNumber: snapshot.tenderNumber,
    title: snapshot.title,
  })

  return { workspace: updated, created: true }
}

async function removeTenderEntry(userId, subcollection, tenderId) {
  const db = getFirestore()
  await db
    .collection(COLLECTION)
    .doc(userId)
    .collection(subcollection)
    .doc(tenderId)
    .delete()

  const workspace = await getWorkspaceDoc(userId)
  const idField =
    subcollection === 'savedTenders' ? 'savedTenderIds' : 'trackedTenderIds'
  const ids = (workspace[idField] || []).filter((id) => id !== tenderId)
  const updated = await saveWorkspaceDoc(userId, { [idField]: ids })
  return { workspace: updated }
}

async function saveTender(userId, tender) {
  return addTenderEntry(userId, 'savedTenders', tender.id, tender)
}

async function unsaveTender(userId, tenderId) {
  return removeTenderEntry(userId, 'savedTenders', tenderId)
}

async function trackTender(userId, tender) {
  return addTenderEntry(userId, 'trackedTenders', tender.id, tender)
}

async function untrackTender(userId, tenderId) {
  return removeTenderEntry(userId, 'trackedTenders', tenderId)
}

async function followDepartment(userId, department) {
  const name = String(department || '').trim()
  if (!name) throw new Error('Department is required')
  const slug = slugify(name)
  const db = getFirestore()
  const ref = db
    .collection(COLLECTION)
    .doc(userId)
    .collection('watchedDepartments')
    .doc(slug)
  if ((await ref.get()).exists) {
    return { workspace: await getWorkspaceDoc(userId), created: false }
  }
  await ref.set(
    sanitizeFirestoreData({ department: name, slug, createdAt: new Date().toISOString() })
  )
  const workspace = await getWorkspaceDoc(userId)
  const watched = new Set(workspace.watchedDepartments || [])
  watched.add(name)
  const updated = await saveWorkspaceDoc(userId, {
    watchedDepartments: Array.from(watched),
  })
  return { workspace: updated, created: true }
}

async function followProvince(userId, province) {
  const name = String(province || '').trim()
  if (!name) throw new Error('Province is required')
  const slug = slugify(name)
  const db = getFirestore()
  const ref = db
    .collection(COLLECTION)
    .doc(userId)
    .collection('watchedProvinces')
    .doc(slug)
  if ((await ref.get()).exists) {
    return { workspace: await getWorkspaceDoc(userId), created: false }
  }
  await ref.set(
    sanitizeFirestoreData({ province: name, slug, createdAt: new Date().toISOString() })
  )
  const workspace = await getWorkspaceDoc(userId)
  const watched = new Set(workspace.watchedProvinces || [])
  watched.add(name)
  const updated = await saveWorkspaceDoc(userId, {
    watchedProvinces: Array.from(watched),
  })
  return { workspace: updated, created: true }
}

async function unfollowDepartment(userId, department) {
  const slug = slugify(department)
  const db = getFirestore()
  await db
    .collection(COLLECTION)
    .doc(userId)
    .collection('watchedDepartments')
    .doc(slug)
    .delete()
  const workspace = await getWorkspaceDoc(userId)
  const watched = (workspace.watchedDepartments || []).filter(
    (d) => slugify(d) !== slug && d !== department
  )
  const updated = await saveWorkspaceDoc(userId, { watchedDepartments: watched })
  return { workspace: updated }
}

async function unfollowProvince(userId, province) {
  const slug = slugify(province)
  const db = getFirestore()
  await db
    .collection(COLLECTION)
    .doc(userId)
    .collection('watchedProvinces')
    .doc(slug)
    .delete()
  const workspace = await getWorkspaceDoc(userId)
  const watched = (workspace.watchedProvinces || []).filter(
    (p) => slugify(p) !== slug && p !== province
  )
  const updated = await saveWorkspaceDoc(userId, { watchedProvinces: watched })
  return { workspace: updated }
}

module.exports = {
  saveTender,
  unsaveTender,
  trackTender,
  untrackTender,
  followDepartment,
  followProvince,
  unfollowDepartment,
  unfollowProvince,
  getWorkspaceDoc,
}
