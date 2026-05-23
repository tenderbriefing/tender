#!/usr/bin/env node
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const { getFirestore } = require('../backend/config/firebaseAdmin')

async function countCollection(name) {
  const snap = await getFirestore().collection(name).count().get()
  return snap.data().count
}

async function main() {
  const [briefings, auditLogs] = await Promise.all([
    countCollection('tenderBriefings'),
    countCollection('auditLogs'),
  ])
  const syncDoc = await getFirestore().collection('syncStatus').doc('current').get()
  console.log(JSON.stringify({
    tenderBriefings: briefings,
    auditLogs,
    syncStatusExists: syncDoc.exists,
    lastSuccessfulSync: syncDoc.exists ? syncDoc.data()?.lastSuccessfulSync : null,
    apiHealth: syncDoc.exists ? syncDoc.data()?.apiHealth : null,
  }, null, 2))
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
