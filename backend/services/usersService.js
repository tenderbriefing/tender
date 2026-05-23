const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

async function getYouthAgents() {
  const db = getFirestore()
  const snapshot = await db.collection('users').where('userType', '==', 'youth-agent').get()

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      userType: 'youth-agent',
      displayName: data.displayName || '',
      name: data.displayName || '',
      email: data.email || '',
      province: data.location || data.province || '',
      rating: data.rating || 3,
      verified: data.verified === true,
      availability: data.availability || 'available',
      missedMeetings: data.missedMeetings || 0,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    }
  })
}

async function getUserById(uid) {
  const db = getFirestore()
  const doc = await db.collection('users').doc(uid).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() }
}

async function upsertAgentProfile(agent) {
  const db = getFirestore()
  const payload = sanitizeFirestoreData({
    ...agent,
    categories: agent.categories ?? [],
    skills: agent.skills ?? [],
    updatedAt: new Date().toISOString(),
  })
  await db.collection('agents').doc(agent.id).set(payload, { merge: true })
  return agent
}

async function upsertSmeProfile(sme) {
  const db = getFirestore()
  const payload = sanitizeFirestoreData({
    ...sme,
    categories: sme.categories ?? [],
    companyName: sme.companyName ?? '',
    updatedAt: new Date().toISOString(),
  })
  await db.collection('smes').doc(sme.id).set(payload, { merge: true })
  return sme
}

module.exports = {
  getYouthAgents,
  getUserById,
  upsertAgentProfile,
  upsertSmeProfile,
}
