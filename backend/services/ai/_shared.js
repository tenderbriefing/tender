/**
 * Shared AI / ops helpers.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')

function nowIso() {
  return new Date().toISOString()
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) return null
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

function daysUntil(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

async function persistInsight(collection, docId, payload) {
  const db = getFirestore()
  const data = sanitizeFirestoreData({
    ...payload,
    updatedAt: nowIso(),
  })
  await db.collection(collection).doc(docId).set(data, { merge: true })
  return { id: docId, ...data }
}

module.exports = {
  nowIso,
  clamp,
  haversineKm,
  daysUntil,
  persistInsight,
}
