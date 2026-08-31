#!/usr/bin/env node
/**
 * Production backfill: classify smoke/certification profiles as isTestAccount,
 * and stamp related attendanceRequests as isTestData (no payment rewrites, no deletes).
 *
 * Dry-run by default. Apply with:
 *   APPLY_TEST_ACCOUNT_BACKFILL=1 node scripts/backfill-test-accounts.js
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const {
  matchesSmokeEvidence,
  isTestAccountRecord,
  testAccountWriteFields,
  normalizeEmail,
} = require('../lib/domain/testAccount')

const APPLY = process.env.APPLY_TEST_ACCOUNT_BACKFILL === '1'

function classifyKind(row) {
  const email = normalizeEmail(row.email)
  if (row.userType === 'youth-agent') return 'ops-smoke-agent'
  if (row.userType === 'admin') return 'ops-smoke-admin'
  if (email.includes('phase3')) return 'phase3-cert-smoke'
  if (email.includes('phase2')) return 'phase2-cert-smoke'
  if (email.startsWith('qa-sme-')) return 'qa-orphan'
  if (/@example\.(?:com|org|net)$/i.test(email) || /^gcert\b/i.test(String(row.displayName || ''))) {
    return 'auth-cert-example'
  }
  if (email.includes('sme-control')) return 'ops-smoke-control'
  return 'ops-smoke'
}

async function main() {
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const db = admin.firestore()

  const usersSnap = await db.collection('users').limit(2000).get()
  const smeCountSnap = await db.collection('users').where('userType', '==', 'sme').count().get()
  const smeTotalBefore = smeCountSnap.data().count

  const candidates = []
  for (const doc of usersSnap.docs) {
    const data = { id: doc.id, ...doc.data() }
    if (isTestAccountRecord(data)) {
      candidates.push({ ...data, alreadyFlagged: true })
      continue
    }
    if (matchesSmokeEvidence(data)) {
      candidates.push({ ...data, alreadyFlagged: false })
    }
  }

  const allTestIds = new Set(candidates.map((c) => c.id))
  const smeCandidates = candidates.filter((c) => c.userType === 'sme')
  const toWrite = candidates.filter((c) => !c.alreadyFlagged)

  const requestsSnap = await db.collection('attendanceRequests').limit(2000).get()
  const relatedRequests = []
  for (const doc of requestsSnap.docs) {
    const data = { id: doc.id, ...doc.data() }
    const already = data.isTestData === true
    const ownedByTest =
      (data.smeId && allTestIds.has(data.smeId)) ||
      (data.agentId && allTestIds.has(data.agentId)) ||
      (data.assignedAgentId && allTestIds.has(data.assignedAgentId))
    if (!ownedByTest && !already) continue
    relatedRequests.push({
      id: data.id,
      smeId: data.smeId || null,
      paymentStatus: data.paymentStatus || null,
      paymentAmount: data.paymentAmount ?? null,
      alreadyFlagged: already,
      needsWrite: ownedByTest && !already,
    })
  }

  const report = {
    apply: APPLY,
    scannedUsers: usersSnap.size,
    smeTotalBefore,
    alreadyFlagged: candidates.filter((c) => c.alreadyFlagged).length,
    matchedEvidence: toWrite.length,
    smeToClassify: toWrite.filter((c) => c.userType === 'sme').map(summarize),
    agentToClassify: toWrite.filter((c) => c.userType === 'youth-agent').map(summarize),
    otherToClassify: toWrite
      .filter((c) => c.userType !== 'sme' && c.userType !== 'youth-agent')
      .map(summarize),
    smeAlreadyFlagged: smeCandidates.filter((c) => c.alreadyFlagged).length,
    relatedAttendanceRequests: relatedRequests.length,
    attendanceRequestsToFlag: relatedRequests.filter((r) => r.needsWrite).length,
    written: [],
    attendanceWritten: [],
    recordsDeleted: 0,
    note: 'No deletes. Payment amounts untouched. Duplicate smoke SMEs retained as test accounts.',
  }

  if (APPLY) {
    const now = new Date().toISOString()
    if (toWrite.length) {
      const batchSize = 400
      for (let i = 0; i < toWrite.length; i += batchSize) {
        const chunk = toWrite.slice(i, i + batchSize)
        const batch = db.batch()
        for (const row of chunk) {
          const kind = classifyKind(row)
          const fields = {
            ...testAccountWriteFields(kind),
            updatedAt: now,
            testAccountClassifiedAt: now,
            testAccountClassifiedBy: 'backfill-test-accounts',
          }
          batch.set(db.collection('users').doc(row.id), fields, { merge: true })
          if (row.userType === 'sme') {
            batch.set(db.collection('smes').doc(row.id), fields, { merge: true })
          } else if (row.userType === 'youth-agent') {
            batch.set(db.collection('agents').doc(row.id), fields, { merge: true })
          }
          report.written.push({ id: row.id, email: row.email, userType: row.userType, kind })
        }
        await batch.commit()
      }
    }

    const reqToWrite = relatedRequests.filter((r) => r.needsWrite)
    for (let i = 0; i < reqToWrite.length; i += 400) {
      const chunk = reqToWrite.slice(i, i + 400)
      const batch = db.batch()
      for (const row of chunk) {
        batch.set(
          db.collection('attendanceRequests').doc(row.id),
          {
            isTestData: true,
            testDataClassifiedAt: now,
            testDataClassifiedBy: 'backfill-test-accounts',
          },
          { merge: true }
        )
        report.attendanceWritten.push({ id: row.id, smeId: row.smeId })
      }
      await batch.commit()
    }
  }

  const smeTestAfter = smeCandidates.length
  report.confirmedTestSmes = smeTestAfter
  report.realSmeCountAfterClassification = Math.max(0, smeTotalBefore - smeTestAfter)

  console.log(JSON.stringify(report, null, 2))
}

function summarize(row) {
  return {
    id: row.id,
    email: row.email || null,
    companyName: row.companyName || null,
    displayName: row.displayName || null,
    userType: row.userType || null,
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
