const { env, hasEnv, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = ['FCM_SERVER_KEY']

function getConfig() {
  const hasLegacyKey = hasEnv('FCM_SERVER_KEY')
  const hasFirebaseAdmin =
    hasEnv('GOOGLE_APPLICATION_CREDENTIALS') ||
    hasEnv('FIREBASE_SERVICE_ACCOUNT_JSON')

  return {
    configured: hasLegacyKey || hasFirebaseAdmin,
    missing: hasLegacyKey || hasFirebaseAdmin ? [] : REQUIRED_ENV,
  }
}

function getStatus() {
  const config = getConfig()
  return integrationResult({
    id: 'fcm',
    name: 'Firebase Cloud Messaging',
    status: statusFromConfig(config.configured),
    requiredEnv: [
      'FCM_SERVER_KEY',
      'GOOGLE_APPLICATION_CREDENTIALS (Firebase Admin for FCM v1)',
    ],
    missing: config.missing,
    setupNotes:
      'Store device tokens on users/{uid}.deviceTokens. Prefer Firebase Admin messaging in production.',
  })
}

async function getDeviceTokens(userId) {
  try {
    const firebaseAdmin = require('../../config/firebaseAdmin')
    const db = firebaseAdmin.getFirebaseAdmin().firestore()
    const doc = await db.collection('users').doc(userId).get()
    if (!doc.exists) return []
    const tokens = doc.data()?.deviceTokens
    return Array.isArray(tokens) ? tokens.filter(Boolean) : []
  } catch {
    return []
  }
}

async function sendPushNotification({ userId, title, body, data = {} }) {
  const config = getConfig()
  if (!config.configured) {
    return { ok: false, skipped: true, reason: 'FCM not configured' }
  }

  const tokens = userId ? await getDeviceTokens(userId) : []
  if (!tokens.length) {
    return { ok: false, skipped: true, reason: 'No device tokens for user' }
  }

  if (hasEnv('FCM_SERVER_KEY')) {
    const serverKey = env('FCM_SERVER_KEY')
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: { title, body },
        data,
      }),
    })
    const result = await response.json().catch(() => ({}))
    return {
      ok: response.ok,
      successCount: result.success,
      failureCount: result.failure,
    }
  }

  try {
    const firebaseAdmin = require('../../config/firebaseAdmin')
    const messaging = firebaseAdmin.getFirebaseAdmin().messaging()
    const message = {
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      tokens,
    }
    const result = await messaging.sendEachForMulticast(message)
    return {
      ok: result.failureCount === 0,
      successCount: result.successCount,
      failureCount: result.failureCount,
    }
  } catch (error) {
    return { ok: false, error: error.message || 'FCM send failed' }
  }
}

async function healthCheck() {
  return getStatus()
}

module.exports = {
  REQUIRED_ENV,
  getConfig,
  getStatus,
  getDeviceTokens,
  sendPushNotification,
  healthCheck,
}
