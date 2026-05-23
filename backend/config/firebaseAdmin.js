const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

let initialized = false
let initLogged = false

function resolveProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    null
  )
}

function resolveCredentialsPath() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) return null

  return path.isAbsolute(credPath) ? credPath : path.join(process.cwd(), credPath)
}

function loadServiceAccountFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Service account file not found at ${filePath}. Download from Firebase Console → Project Settings → Service accounts.`
    )
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  if (raw.privateKeyData && !raw.private_key) {
    return JSON.parse(Buffer.from(raw.privateKeyData, 'base64').toString('utf8'))
  }

  if (!raw.private_key || !raw.client_email) {
    throw new Error(
      `Invalid service account file at ${filePath}. Expected Firebase Admin SDK JSON credentials.`
    )
  }

  return raw
}

function buildCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    return admin.credential.cert(serviceAccount)
  }

  const credentialsPath = resolveCredentialsPath()
  if (credentialsPath) {
    const serviceAccount = loadServiceAccountFromFile(credentialsPath)
    return admin.credential.cert(serviceAccount)
  }

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: resolveProjectId(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  }

  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID
  ) {
    return admin.credential.applicationDefault()
  }

  return null
}

function logInitSuccess(projectId) {
  if (initLogged) return
  initLogged = true
  const credSource = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? 'FIREBASE_SERVICE_ACCOUNT_JSON'
    : resolveCredentialsPath()
      ? `GOOGLE_APPLICATION_CREDENTIALS (${resolveCredentialsPath()})`
      : process.env.FIREBASE_CLIENT_EMAIL
        ? 'FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY'
        : 'applicationDefault()'

  console.log(
    `[Firebase Admin] Initialized for project "${projectId}" using ${credSource}`
  )
}

function initializeFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) {
    initialized = true
    return admin
  }

  const projectId = resolveProjectId()
  if (!projectId) {
    throw new Error(
      'Firebase Admin: FIREBASE_PROJECT_ID is required when STORAGE_ADAPTER=firestore.'
    )
  }

  const credential = buildCredential()
  if (!credential) {
    throw new Error(
      'Firebase Admin: No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS=./service-account.json, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
    )
  }

  try {
    admin.initializeApp({
      credential,
      projectId,
    })
    initialized = true
    logInitSuccess(projectId)
    return admin
  } catch (error) {
    initialized = false
    throw new Error(`Firebase Admin initialization failed: ${error.message}`)
  }
}

function getFirebaseAdmin() {
  return initializeFirebaseAdmin()
}

function getFirestore() {
  return getFirebaseAdmin().firestore()
}

function isFirebaseAdminConfigured() {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.FIREBASE_PROJECT_ID
  )
}

async function checkFirestoreConnection() {
  const projectId = resolveProjectId()

  if (!isFirebaseAdminConfigured()) {
    return {
      connected: false,
      projectId,
      error: 'Firebase credentials not configured',
    }
  }

  try {
    const db = getFirestore()
    const probeId = `_health_${Date.now()}`
    const ref = db.collection('_healthChecks').doc(probeId)

    await ref.set({
      checkedAt: new Date().toISOString(),
      source: 'firebaseAdmin.checkFirestoreConnection',
    })
    const snap = await ref.get()
    await ref.delete()

    return {
      connected: snap.exists,
      projectId: resolveProjectId(),
    }
  } catch (error) {
    return {
      connected: false,
      projectId,
      error: error.message,
    }
  }
}

module.exports = {
  getFirebaseAdmin,
  getFirestore,
  isFirebaseAdminConfigured,
  resolveProjectId,
  checkFirestoreConnection,
  initializeFirebaseAdmin,
}
