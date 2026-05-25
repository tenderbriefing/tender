#!/usr/bin/env node
/**
 * Archive QA / duplicate WhatsApp notification docs so hourly retry automation stops re-sending them.
 * No secrets logged.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const { getFirestore } = require('../backend/config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../backend/utils/sanitizeFirestoreData')
const retryPolicy = require('../backend/services/whatsappRetryPolicy')

const ARCHIVE_TYPES = new Set([
  'qa_dup',
  'qa_test',
  'admin_test',
  'idempotency_marker',
])

function nowIso() {
  return new Date().toISOString()
}

function shouldArchive(data, id) {
  const type = String(data.type || '')
  const msg = retryPolicy.notificationMessage(data).toLowerCase()

  if (ARCHIVE_TYPES.has(type)) return true
  if (type.startsWith('qa_')) return true
  if (msg === 'dup2') return true
  if (String(id || '').startsWith('wa-idem-')) return true
  if (retryPolicy.shouldArchiveQaNotification({ ...data, id })) return true
  return false
}

async function main() {
  const db = getFirestore()
  const snap = await db.collection('notifications').where('channel', '==', 'whatsapp').limit(500).get()

  let scanned = 0
  let archived = 0
  const samples = []

  for (const doc of snap.docs) {
    scanned += 1
    const data = doc.data()
    if (!shouldArchive(data, doc.id)) continue
    if (data.status === 'archived' && data.retryable === false) continue

    await doc.ref.set(
      sanitizeFirestoreData({
        status: 'archived',
        retryable: false,
        archivedReason: 'QA duplicate cleanup',
        archivedAt: nowIso(),
        updatedAt: nowIso(),
      }),
      { merge: true }
    )
    archived += 1
    if (samples.length < 8) {
      samples.push({
        id: doc.id,
        type: data.type,
        message: retryPolicy.notificationMessage(data).slice(0, 40),
        priorStatus: data.status,
      })
    }
  }

  const report = {
    scanned,
    archived,
    samples,
    passed: true,
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

main().catch((e) => {
  console.error(JSON.stringify({ passed: false, error: e.message }))
  process.exit(1)
})
