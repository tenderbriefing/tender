#!/usr/bin/env node
/**
 * Firestore connection test for TenderBriefing production project.
 *
 * Usage:
 *   STORAGE_ADAPTER=firestore \
 *   FIREBASE_PROJECT_ID=tenderbriefing-34679 \
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *   node scripts/test-firestore.js
 */

const path = require('path')

process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const { resetStorage } = require('../backend/services/storageAdapter')
const { checkFirestoreConnection, resolveProjectId } = require('../backend/config/firebaseAdmin')
const firestoreService = require('../backend/services/firestoreStorageService')

const TEST_COLLECTION = '_connectionTests'
const TEST_DOC_ID = `test-${Date.now()}`

async function main() {
  console.log('\n=== TenderBriefing Firestore Connection Test ===\n')
  console.log('Project ID:', resolveProjectId())
  console.log('Credentials:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'env JSON / ADC')
  console.log('')

  const health = await checkFirestoreConnection()
  if (!health.connected) {
    console.error('❌ Firestore health check failed:', health.error)
    process.exit(1)
  }
  console.log('✅ Firebase Admin initialized and health probe succeeded')

  resetStorage()
  const { getFirestore } = require('../backend/config/firebaseAdmin')
  const db = getFirestore()
  const ref = db.collection(TEST_COLLECTION).doc(TEST_DOC_ID)

  const payload = {
    message: 'TenderBriefing Firestore connection test',
    createdAt: new Date().toISOString(),
    projectId: resolveProjectId(),
  }

  console.log('\n→ Writing test document...')
  await ref.set(payload)
  console.log('✅ Write OK:', `${TEST_COLLECTION}/${TEST_DOC_ID}`)

  console.log('\n→ Reading test document...')
  const snap = await ref.get()
  if (!snap.exists) {
    throw new Error('Document read back as missing')
  }
  console.log('✅ Read OK:', JSON.stringify(snap.data(), null, 2))

  console.log('\n→ Testing storage service upsert...')
  const testTender = {
    id: `fs-test-${Date.now()}`,
    ocid: `ocds-fs-test-${Date.now()}`,
    tenderNumber: 'FS-TEST-001',
    title: 'Firestore adapter test tender',
    description: 'Connection test record — safe to delete',
    department: 'TenderBriefing',
    buyer: 'TenderBriefing',
    province: 'Gauteng',
    category: 'Services',
    industrySector: 'Consulting',
    industryConfidence: 0.5,
    procurementMethod: 'RFQ',
    status: 'active',
    publishedDate: new Date().toISOString(),
    closingDate: new Date(Date.now() + 86400000 * 14).toISOString(),
    briefingDate: '',
    briefingTime: '',
    briefingVenue: '',
    briefingCompulsory: false,
    briefingConfidence: 0,
    matchedBriefingTerms: [],
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    meetingLink: '',
    documents: [],
    detailUrl: '',
    summary: 'Firestore test',
    requirements: [],
    risks: [],
    keyDates: [],
    recommendedFor: [],
    opportunityScore: 0,
    calendarEvents: [],
    history: [],
    source: 'scripts/test-firestore.js',
    lastSyncedAt: new Date().toISOString(),
    scrapedAt: new Date().toISOString(),
  }

  await firestoreService.upsertTenders([testTender])
  const loaded = await firestoreService.getTenderById(testTender.id)
  if (!loaded) throw new Error('Storage service could not read upserted tender')
  console.log('✅ Storage service upsert/read OK:', loaded.id)

  console.log('\n→ Deleting test documents...')
  await ref.delete()
  await db.collection(firestoreService.COLLECTIONS.TENDER_BRIEFINGS).doc(testTender.id).delete()
  console.log('✅ Cleanup OK')

  console.log('\n=== All Firestore tests passed ===\n')
}

main().catch((err) => {
  console.error('\n❌ Firestore test failed:', err.message)
  process.exit(1)
})
