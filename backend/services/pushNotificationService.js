/**
 * Push notification abstraction — FCM token registration + delivery.
 */
const fcmService = require('./integrations/fcmService')
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

async function registerToken(userId, token, { platform = 'web' } = {}) {
  if (!userId || !token) {
    return { ok: false, error: 'userId and token are required' }
  }
  const db = getFirestore()
  const ref = db.collection('users').doc(userId)
  const doc = await ref.get()
  const existing = doc.exists ? doc.data()?.deviceTokens || [] : []
  const tokens = Array.from(new Set([...existing, token]))
  await ref.set(
    sanitizeFirestoreData({
      deviceTokens: tokens,
      pushPlatform: platform,
      pushTokenUpdatedAt: new Date().toISOString(),
    }),
    { merge: true }
  )
  return { ok: true, tokenCount: tokens.length }
}

async function removeToken(userId, token) {
  if (!userId || !token) return { ok: false, error: 'userId and token required' }
  const db = getFirestore()
  const ref = db.collection('users').doc(userId)
  const doc = await ref.get()
  if (!doc.exists) return { ok: true, tokenCount: 0 }
  const tokens = (doc.data()?.deviceTokens || []).filter((t) => t !== token)
  await ref.set({ deviceTokens: tokens, pushTokenUpdatedAt: new Date().toISOString() }, { merge: true })
  return { ok: true, tokenCount: tokens.length }
}

async function sendPush({ userId, title, body, data = {} }) {
  return fcmService.sendPushNotification({ userId, title, body, data })
}

function getStatus() {
  return fcmService.getStatus()
}

module.exports = {
  registerToken,
  removeToken,
  sendPush,
  getStatus,
}
