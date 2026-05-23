const { env, hasEnv, checkRequired, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = ['FIREBASE_STORAGE_BUCKET']

function resolveBucket() {
  return (
    env('FIREBASE_STORAGE_BUCKET') ||
    env('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') ||
    ''
  )
}

function getConfig() {
  const bucket = resolveBucket()
  const hasBucket = bucket.length > 0
  const hasAdmin =
    hasEnv('GOOGLE_APPLICATION_CREDENTIALS') ||
    hasEnv('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    hasEnv('FIREBASE_PROJECT_ID')

  return {
    configured: hasBucket && hasAdmin,
    missing: [
      ...(!hasBucket ? ['FIREBASE_STORAGE_BUCKET'] : []),
      ...(!hasAdmin
        ? ['GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON']
        : []),
    ],
    bucket,
  }
}

function getStatus() {
  const config = getConfig()
  return integrationResult({
    id: 'firebase_storage',
    name: 'Firebase Storage',
    status: statusFromConfig(config.configured),
    requiredEnv: [
      'FIREBASE_STORAGE_BUCKET',
      'GOOGLE_APPLICATION_CREDENTIALS',
      'FIREBASE_PROJECT_ID',
    ],
    missing: config.missing,
    setupNotes:
      'Enable Storage in Firebase Console, deploy storage.rules, then use briefing-proofs/{requestId}/ paths.',
  })
}

function getStorageBucket() {
  try {
    const firebaseAdmin = require('../../config/firebaseAdmin')
    const admin = firebaseAdmin.getFirebaseAdmin()
    const bucketName = resolveBucket()
    if (!bucketName) return null
    return admin.storage().bucket(bucketName)
  } catch {
    return null
  }
}

/**
 * Upload briefing proof file (framework — Storage may be disabled in project).
 */
async function uploadBriefingProof({ requestId, fileName, buffer, contentType }) {
  const config = getConfig()
  if (!config.configured) {
    return {
      ok: false,
      skipped: true,
      reason: 'Firebase Storage not configured',
    }
  }

  const bucket = getStorageBucket()
  if (!bucket) {
    return {
      ok: false,
      skipped: true,
      reason: 'Storage bucket unavailable (enable Firebase Storage in console)',
    }
  }

  const safeName = String(fileName || 'proof').replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectPath = `briefing-proofs/${requestId}/${Date.now()}-${safeName}`
  const file = bucket.file(objectPath)

  try {
    await file.save(buffer, {
      metadata: { contentType: contentType || 'application/octet-stream' },
      resumable: false,
    })
    return {
      ok: true,
      path: objectPath,
      bucket: bucket.name,
    }
  } catch (error) {
    return {
      ok: false,
      error: error.message || 'Upload failed',
    }
  }
}

async function healthCheck() {
  const status = getStatus()
  if (status.status !== 'configured') return status

  const bucket = getStorageBucket()
  if (!bucket) {
    return integrationResult({
      id: 'firebase_storage',
      name: 'Firebase Storage',
      status: 'missing',
      requiredEnv: status.requiredEnv,
      missing: ['Storage admin SDK not initialized'],
      setupNotes: status.setupNotes,
      message: 'Enable Firebase Storage and verify service account permissions.',
    })
  }

  try {
    await bucket.exists()
    return integrationResult({
      ...status,
      status: 'configured',
      message: 'Bucket reachable',
    })
  } catch (error) {
    return integrationResult({
      ...status,
      status: 'error',
      message: error.message || 'Bucket check failed',
    })
  }
}

module.exports = {
  REQUIRED_ENV,
  getConfig,
  getStatus,
  uploadBriefingProof,
  healthCheck,
}
