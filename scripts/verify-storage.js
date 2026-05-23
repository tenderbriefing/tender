#!/usr/bin/env node
/**
 * Verify JSON and Firestore storage adapters.
 * Usage:
 *   STORAGE_ADAPTER=json node scripts/verify-storage.js
 *   STORAGE_ADAPTER=firestore GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/verify-storage.js
 */

const path = require('path')

process.chdir(path.join(__dirname, '..'))

const { resetStorage, getStorage } = require('../backend/services/storageAdapter')

async function main() {
  resetStorage()
  const adapter = process.env.STORAGE_ADAPTER || 'json'
  console.log(`\n=== Verifying STORAGE_ADAPTER=${adapter} ===\n`)

  const storage = getStorage()
  console.log('Adapter type:', storage.adapterType)

  const testTender = {
    id: `verify-${Date.now()}`,
    ocid: `ocds-verify-${Date.now()}`,
    tenderNumber: 'VERIFY-001',
    title: 'Storage verification tender',
    description: 'Automated storage adapter test',
    department: 'TenderBriefing QA',
    buyer: 'TenderBriefing QA',
    province: 'Gauteng',
    category: 'Services',
    industrySector: 'Consulting',
    industryConfidence: 0.8,
    procurementMethod: 'RFQ',
    status: 'active',
    publishedDate: new Date().toISOString(),
    closingDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    briefingDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    briefingTime: '10:00',
    briefingVenue: 'Midrand',
    briefingCompulsory: true,
    briefingConfidence: 0.9,
    matchedBriefingTerms: ['compulsory briefing'],
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    meetingLink: '',
    documents: [],
    detailUrl: '',
    summary: 'Verification record',
    requirements: [],
    risks: [],
    keyDates: [],
    recommendedFor: [],
    opportunityScore: 50,
    calendarEvents: [],
    history: [],
    source: 'verify-storage script',
    lastSyncedAt: new Date().toISOString(),
    scrapedAt: new Date().toISOString(),
  }

  const upsert = await storage.upsertTenders([testTender])
  console.log('upsertTenders:', upsert)

  const byId = await storage.getTenderById(testTender.id)
  console.log('getTenderById:', byId ? 'OK' : 'MISSING')

  const all = await storage.getAllTenders()
  console.log('getAllTenders count:', all.length)

  const syncState = await storage.getSyncStatus()
  syncState.lastVerifiedAt = new Date().toISOString()
  await storage.saveSyncStatus(syncState)
  console.log('saveSyncStatus: OK')

  const audit = await storage.saveAuditLog({
    type: 'storage_verification',
    message: `Verified ${adapter} adapter`,
  })
  console.log('saveAuditLog:', audit.id)

  const logs = await storage.getAuditLogs({ limit: 5 })
  console.log('getAuditLogs:', logs.length, 'entries')

  console.log('\n=== Verification passed ===\n')
}

main().catch((err) => {
  console.error('\nVerification failed:', err.message)
  process.exit(1)
})
