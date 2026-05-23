#!/usr/bin/env node
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const { resetStorage } = require('../backend/services/storageAdapter')
const sync = require('../backend/services/incrementalSyncService')
const firestoreService = require('../backend/services/firestoreStorageService')

async function main() {
  resetStorage()
  console.log('Running OCDS → Firestore sync...\n')

  const result = await sync.runSync({ force: true })

  console.log('Result:', JSON.stringify({
    success: result.success,
    storageAdapter: result.storageAdapter,
    stats: result.stats,
    error: result.error,
    syncLog: result.syncLog,
  }, null, 2))

  const tenders = await firestoreService.getAllTenders()
  console.log('\nFirestore tenderBriefings:', tenders.length)

  const sample = tenders.find((t) => t.briefingCompulsory) || tenders[0]
  if (sample) {
    console.log('\nSample document:')
    console.log(JSON.stringify(sample, null, 2))
  }

  const status = await firestoreService.getSyncStatus()
  console.log('\nsyncStatus/current:')
  console.log(JSON.stringify(status, null, 2))

  if (!result.success) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
