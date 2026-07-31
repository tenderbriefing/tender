// Firebase web app configuration (public client values — embedded in browser bundle).
// Production requires NEXT_PUBLIC_FIREBASE_* and fails closed without them.
// Non-production may use the known public web config for local DX only.

const isProd = process.env.NODE_ENV === 'production'

/** Public Firebase web config for project tenderbriefing-34679 — not a secret. */
const PUBLIC_WEB_FALLBACK = {
  apiKey: 'AIzaSyDk_QBzmOXJfdl4PPqycoKtecGu0ioCRuY',
  authDomain: 'tenderbriefing-34679.firebaseapp.com',
  projectId: 'tenderbriefing-34679',
  storageBucket: 'tenderbriefing-34679.firebasestorage.app',
  messagingSenderId: '9058655644',
  appId: '1:9058655644:web:fbd4b4a46102aa3dd73c59',
  measurementId: 'G-KDQ56R3P5S',
}

function pick(envName: string, fallback: string): string {
  const fromEnv = process.env[envName]
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  if (isProd) return ''
  return fallback
}

export const firebaseConfig = {
  apiKey: pick('NEXT_PUBLIC_FIREBASE_API_KEY', PUBLIC_WEB_FALLBACK.apiKey),
  authDomain: pick('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', PUBLIC_WEB_FALLBACK.authDomain),
  projectId: pick('NEXT_PUBLIC_FIREBASE_PROJECT_ID', PUBLIC_WEB_FALLBACK.projectId),
  storageBucket: pick(
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    PUBLIC_WEB_FALLBACK.storageBucket
  ),
  messagingSenderId: pick(
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    PUBLIC_WEB_FALLBACK.messagingSenderId
  ),
  appId: pick('NEXT_PUBLIC_FIREBASE_APP_ID', PUBLIC_WEB_FALLBACK.appId),
  measurementId: pick(
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
    PUBLIC_WEB_FALLBACK.measurementId
  ),
}

export function getFirebaseConfig() {
  const config = { ...firebaseConfig }
  if (isProd && (!config.apiKey || !config.projectId || !config.appId)) {
    throw new Error(
      'Firebase web config missing: set NEXT_PUBLIC_FIREBASE_API_KEY, PROJECT_ID, and APP_ID'
    )
  }
  return config
}
