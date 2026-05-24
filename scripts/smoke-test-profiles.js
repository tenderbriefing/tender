/**
 * Shared smoke-test user profile shapes (aligned with client registration schema).
 */
const { sanitizeFirestoreData } = require('../backend/utils/sanitizeFirestoreData')

function nowIso() {
  return new Date().toISOString()
}

function buildSmokeUserDoc({ uid, email, displayName, userType, timestamp, extra = {} }) {
  return sanitizeFirestoreData({
    uid,
    email,
    displayName,
    role: userType,
    userType,
    phoneNumber: extra.phoneNumber || '+27000000000',
    location: extra.province || extra.location || 'Gauteng',
    province: extra.province || 'Gauteng',
    companyName: userType === 'sme' ? extra.companyName || 'Smoke Test SME (Pty) Ltd' : '',
    contactPerson: userType === 'sme' ? extra.contactPerson || displayName : undefined,
    categories: userType === 'sme' ? extra.categories || ['information-technology'] : [],
    sectors: userType === 'sme' ? extra.categories || ['information-technology'] : [],
    provincesOfInterest: userType === 'sme' ? [extra.province || 'Gauteng'] : [],
    city: userType === 'youth-agent' ? extra.city || 'Johannesburg' : undefined,
    availabilityRadiusKm: userType === 'youth-agent' ? extra.availabilityRadiusKm ?? 25 : undefined,
    transportAvailable: userType === 'youth-agent' ? true : undefined,
    preferredServiceAreas:
      userType === 'youth-agent' ? extra.preferredServiceAreas || ['Gauteng'] : undefined,
    verificationStatus: userType === 'youth-agent' ? 'verified' : undefined,
    reliabilityScore: userType === 'youth-agent' ? 100 : undefined,
    missedBriefingCount: userType === 'youth-agent' ? 0 : undefined,
    completedBriefingCount: userType === 'youth-agent' ? 0 : undefined,
    acceptedBriefingCount: userType === 'youth-agent' ? 0 : undefined,
    rating: userType === 'youth-agent' ? 4 : undefined,
    availability: userType === 'youth-agent' ? 'available' : undefined,
    verified: userType === 'youth-agent' ? true : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...extra,
  })
}

function buildSmokeSmeDoc({ uid, email, displayName, timestamp, extra = {} }) {
  const companyName = extra.companyName || 'Smoke Test SME (Pty) Ltd'
  const province = extra.province || 'Gauteng'
  const categories = extra.categories || ['information-technology']
  return sanitizeFirestoreData({
    id: uid,
    uid,
    email,
    role: 'sme',
    userType: 'sme',
    displayName,
    companyName,
    contactPerson: extra.contactPerson || displayName,
    phoneNumber: extra.phoneNumber || '+27000000000',
    phone: extra.phoneNumber || '+27000000000',
    province,
    location: extra.location || province,
    categories,
    sectors: categories,
    provincesOfInterest: [province],
    csdNumber: extra.csdNumber || '',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

function buildSmokeAgentDoc({ uid, email, displayName, timestamp, extra = {} }) {
  const province = extra.province || 'Gauteng'
  const city = extra.city || 'Johannesburg'
  return sanitizeFirestoreData({
    id: uid,
    uid,
    email,
    role: 'youth-agent',
    userType: 'youth-agent',
    displayName,
    fullName: displayName,
    name: displayName,
    phoneNumber: extra.phoneNumber || '+27000000000',
    phone: extra.phoneNumber || '+27000000000',
    province,
    city,
    location: extra.location || `${city}, ${province}`,
    availabilityRadiusKm: extra.availabilityRadiusKm ?? 25,
    availabilityRadius: extra.availabilityRadiusKm ?? 25,
    transportAvailable: true,
    transportAvailability: true,
    preferredServiceAreas: extra.preferredServiceAreas || [province],
    preferredAreas: extra.preferredServiceAreas || [province],
    verificationStatus: 'verified',
    verified: true,
    reliabilityScore: 100,
    missedBriefingCount: 0,
    completedBriefingCount: 0,
    acceptedBriefingCount: 0,
    rating: 4,
    availability: 'available',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

async function ensureSmokeRoleProfiles(db, { uid, email, displayName, userType, extra = {} }) {
  const timestamp = nowIso()
  const userDoc = buildSmokeUserDoc({ uid, email, displayName, userType, timestamp, extra })
  await db.collection('users').doc(uid).set(userDoc, { merge: true })

  if (userType === 'sme') {
    await db
      .collection('smes')
      .doc(uid)
      .set(buildSmokeSmeDoc({ uid, email, displayName, timestamp, extra }), { merge: true })
  } else if (userType === 'youth-agent') {
    await db
      .collection('agents')
      .doc(uid)
      .set(buildSmokeAgentDoc({ uid, email, displayName, timestamp, extra }), { merge: true })
  }

  return userDoc
}

const ORPHAN_QA_EMAIL = 'qa-sme-1779612894@tenderbriefing.co.za'

async function cleanupOrphanQaUser(admin) {
  try {
    const authUser = await admin.auth().getUserByEmail(ORPHAN_QA_EMAIL)
    const uid = authUser.uid
    const db = admin.firestore()

    const userDoc = await db.collection('users').doc(uid).get()
    if (userDoc.exists) {
      return { email: ORPHAN_QA_EMAIL, action: 'skipped', reason: 'users profile exists' }
    }

    const requests = await db
      .collection('attendanceRequests')
      .where('smeId', '==', uid)
      .limit(1)
      .get()
    if (!requests.empty) {
      return { email: ORPHAN_QA_EMAIL, action: 'skipped', reason: 'has attendance requests' }
    }

    const smeDoc = await db.collection('smes').doc(uid).get()
    if (smeDoc.exists) {
      return { email: ORPHAN_QA_EMAIL, action: 'skipped', reason: 'has smes profile' }
    }

    await admin.auth().deleteUser(uid)
    return { email: ORPHAN_QA_EMAIL, action: 'deleted', uid }
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      return { email: ORPHAN_QA_EMAIL, action: 'none', reason: 'not found' }
    }
    throw e
  }
}

module.exports = {
  buildSmokeUserDoc,
  buildSmokeSmeDoc,
  buildSmokeAgentDoc,
  ensureSmokeRoleProfiles,
  cleanupOrphanQaUser,
  ORPHAN_QA_EMAIL,
}
