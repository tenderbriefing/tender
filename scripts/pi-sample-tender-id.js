#!/usr/bin/env node
/** Print one tenderBriefings doc id to stdout only (last line). */
process.chdir(require('path').join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
;(async () => {
  const s = await getFirebaseAdmin().firestore().collection('tenderBriefings').limit(1).get()
  if (!s.docs[0]) throw new Error('no tenders')
  // Ensure only the id is useful; callers should take last non-empty line
  console.log(s.docs[0].id)
})().catch((e) => {
  console.error(String(e.message || e).slice(0, 160))
  process.exit(1)
})
