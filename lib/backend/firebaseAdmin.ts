/**
 * TypeScript bridge to Firebase Admin (CommonJS config module).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdmin = require('../../backend/config/firebaseAdmin')

export const getFirebaseAdmin = firebaseAdmin.getFirebaseAdmin
export const getFirestore = firebaseAdmin.getFirestore
export const isFirebaseAdminConfigured = firebaseAdmin.isFirebaseAdminConfigured
export const resolveProjectId = firebaseAdmin.resolveProjectId
export const checkFirestoreConnection = firebaseAdmin.checkFirestoreConnection
export const initializeFirebaseAdmin = firebaseAdmin.initializeFirebaseAdmin
