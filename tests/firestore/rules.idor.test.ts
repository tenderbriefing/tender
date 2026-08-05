/**
 * Firestore Security Rules — IDOR / privilege-escalation matrix.
 *
 * Runs against the Firestore emulator (never production) using
 * @firebase/rules-unit-testing. Must be invoked via:
 *
 *   npm run test:firestore-rules-emulator
 *
 * which wraps this suite in `firebase emulators:exec` so an emulator is
 * always up before Vitest connects. See tests/firestore/README.md.
 *
 * Identities under test: unauthenticated, SME A, SME B, agent A, agent B, admin.
 * Collections under test: users, attendanceRequests, briefingReports, auditLogs.
 */
import { randomUUID } from 'node:crypto'
import fs from 'fs'
import path from 'path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'

const PROJECT_ID = 'demo-tenderbriefing'

const SME_A = 'sme-a-uid'
const SME_B = 'sme-b-uid'
const AGENT_A = 'agent-a-uid'
const AGENT_B = 'agent-b-uid'
const ADMIN = 'admin-uid'

function resolveEmulatorHostPort(): { host: string; port: number } {
  const envHost = process.env.FIRESTORE_EMULATOR_HOST
  if (envHost) {
    const [host, portStr] = envHost.split(':')
    return { host, port: Number(portStr) }
  }
  // Falls back to the port configured in firebase.json's emulators.firestore.
  return { host: '127.0.0.1', port: 8085 }
}

function uid(prefix: string): string {
  return `${prefix}-${randomUUID()}`
}

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  const { host, port } = resolveEmulatorHostPort()
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
      host,
      port,
    },
  })
}, 30_000)

afterAll(async () => {
  await testEnv?.cleanup()
})

// Isolation: every test seeds its own uniquely-named documents, and the whole
// emulator dataset is wiped between tests so no fixture can leak across cases.
beforeEach(async () => {
  await seedUser(SME_A, { userType: 'sme', email: 'sme-a@example.com' })
  await seedUser(SME_B, { userType: 'sme', email: 'sme-b@example.com' })
  await seedUser(AGENT_A, { userType: 'youth-agent', email: 'agent-a@example.com' })
  await seedUser(AGENT_B, { userType: 'youth-agent', email: 'agent-b@example.com' })
  await seedUser(ADMIN, { userType: 'admin', email: 'admin@example.com' })
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

async function seedUser(userId: string, data: Record<string, unknown>) {
  await seed('users', userId, data)
}

/** Seeds a fixture doc using the Admin-equivalent bypass (rules disabled). */
async function seed(collectionName: string, docId: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionName, docId), data)
  })
}

function firestoreAs(actorUid: string | null): Firestore {
  const ctx = actorUid ? testEnv.authenticatedContext(actorUid) : testEnv.unauthenticatedContext()
  return ctx.firestore()
}

describe('attendanceRequests — IDOR matrix', () => {
  it('SME A cannot read SME B attendance request', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_B,
      status: 'pending',
      paymentStatus: 'pending',
    })

    await assertFails(getDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId)))
  })

  it('SME A cannot update SME B attendance request', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_B,
      status: 'pending',
      paymentStatus: 'pending',
    })

    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId), {
        notes: 'trying to touch someone else request',
      })
    )
  })

  it('SME B can read and update its own attendance request (sanity)', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_B,
      status: 'pending',
      paymentStatus: 'pending',
    })

    await assertSucceeds(getDoc(doc(firestoreAs(SME_B), 'attendanceRequests', requestId)))
    await assertSucceeds(
      updateDoc(doc(firestoreAs(SME_B), 'attendanceRequests', requestId), {
        notes: 'own request, non-privileged field',
      })
    )
  })

  it('SME cannot set paymentStatus to paid on its own request', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      status: 'pending',
      paymentStatus: 'pending',
    })

    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId), {
        paymentStatus: 'paid',
      })
    )
  })

  it('SME cannot set agentId on its own request', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      status: 'pending',
      paymentStatus: 'pending',
    })

    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId), {
        agentId: AGENT_A,
      })
    )
  })

  it('SME cannot set status to assigned on its own request', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      status: 'pending',
      paymentStatus: 'pending',
    })

    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId), {
        status: 'assigned',
      })
    )
  })

  it('Agent A cannot read or update a request it is not linked to', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_B,
      agentId: AGENT_B,
      status: 'assigned',
      paymentStatus: 'pending',
    })

    await assertFails(getDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', requestId)))
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', requestId), {
        status: 'completed',
      })
    )
  })

  it('Agent A cannot escalate privileged fields even on its own assigned request', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_B,
      agentId: AGENT_A,
      status: 'assigned',
      paymentStatus: 'pending',
    })

    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', requestId), {
        status: 'completed',
      })
    )
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', requestId), {
        paymentStatus: 'paid',
      })
    )
    // Non-privileged fields remain editable by the linked agent.
    await assertSucceeds(
      updateDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', requestId), {
        agentNotes: 'arrived on site',
      })
    )
  })

  it('Agent can read a request only once notified or assigned', async () => {
    const notifiedRequestId = uid('req')
    await seed('attendanceRequests', notifiedRequestId, {
      smeId: SME_A,
      status: 'pending',
      paymentStatus: 'pending',
      notifiedAgents: [AGENT_A],
    })
    await assertSucceeds(getDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', notifiedRequestId)))

    const assignedRequestId = uid('req')
    await seed('attendanceRequests', assignedRequestId, {
      smeId: SME_A,
      assignedAgentId: AGENT_B,
      status: 'assigned',
      paymentStatus: 'pending',
    })
    await assertSucceeds(getDoc(doc(firestoreAs(AGENT_B), 'attendanceRequests', assignedRequestId)))

    // Agent B was neither notified nor assigned on the first request.
    await assertFails(getDoc(doc(firestoreAs(AGENT_B), 'attendanceRequests', notifiedRequestId)))
  })

  it('unauthenticated clients are denied on attendanceRequests', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      status: 'pending',
      paymentStatus: 'pending',
    })

    await assertFails(getDoc(doc(firestoreAs(null), 'attendanceRequests', requestId)))
    await assertFails(
      setDoc(doc(firestoreAs(null), 'attendanceRequests', uid('req')), {
        smeId: SME_A,
        status: 'pending',
        paymentStatus: 'pending',
      })
    )
  })

  it('admin can read and update any attendance request (sanity)', async () => {
    const requestId = uid('req')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      status: 'pending',
      paymentStatus: 'pending',
    })

    await assertSucceeds(getDoc(doc(firestoreAs(ADMIN), 'attendanceRequests', requestId)))
    await assertSucceeds(
      updateDoc(doc(firestoreAs(ADMIN), 'attendanceRequests', requestId), {
        paymentStatus: 'paid',
        status: 'assigned',
        agentId: AGENT_A,
      })
    )
  })
})

describe('briefingReports — IDOR matrix', () => {
  it('SME A cannot read SME B briefingReports', async () => {
    const reportId = uid('report')
    await seed('briefingReports', reportId, {
      smeId: SME_B,
      agentId: AGENT_B,
    })

    await assertFails(getDoc(doc(firestoreAs(SME_A), 'briefingReports', reportId)))
  })

  it('agent A cannot read agent B briefingReports', async () => {
    const reportId = uid('report')
    await seed('briefingReports', reportId, {
      smeId: SME_B,
      agentId: AGENT_B,
    })

    await assertFails(getDoc(doc(firestoreAs(AGENT_A), 'briefingReports', reportId)))
  })

  it('owning SME and agent can read their own briefingReport (sanity)', async () => {
    const reportId = uid('report')
    await seed('briefingReports', reportId, {
      smeId: SME_B,
      agentId: AGENT_B,
    })

    await assertSucceeds(getDoc(doc(firestoreAs(SME_B), 'briefingReports', reportId)))
    await assertSucceeds(getDoc(doc(firestoreAs(AGENT_B), 'briefingReports', reportId)))
    await assertSucceeds(getDoc(doc(firestoreAs(ADMIN), 'briefingReports', reportId)))
  })
})

describe('auditLogs — privileged collection', () => {
  it('non-admin (SME) cannot write auditLogs', async () => {
    const logId = uid('log')
    await assertFails(
      setDoc(doc(firestoreAs(SME_A), 'auditLogs', logId), {
        action: 'forged-entry',
        actorUid: SME_A,
      })
    )
  })

  it('non-admin (agent) cannot write auditLogs', async () => {
    const logId = uid('log')
    await assertFails(
      setDoc(doc(firestoreAs(AGENT_A), 'auditLogs', logId), {
        action: 'forged-entry',
        actorUid: AGENT_A,
      })
    )
  })

  it('admin client cannot write auditLogs either — audit trail is Admin SDK only', async () => {
    const logId = uid('log')
    await assertFails(
      setDoc(doc(firestoreAs(ADMIN), 'auditLogs', logId), {
        action: 'admin-attempt',
        actorUid: ADMIN,
      })
    )
  })

  it('non-admin cannot read auditLogs', async () => {
    const logId = uid('log')
    await seed('auditLogs', logId, { action: 'seeded', actorUid: ADMIN })

    await assertFails(getDoc(doc(firestoreAs(SME_A), 'auditLogs', logId)))
    await assertFails(getDoc(doc(firestoreAs(AGENT_A), 'auditLogs', logId)))
  })

  it('admin can read auditLogs (sanity)', async () => {
    const logId = uid('log')
    await seed('auditLogs', logId, { action: 'seeded', actorUid: ADMIN })

    await assertSucceeds(getDoc(doc(firestoreAs(ADMIN), 'auditLogs', logId)))
  })
})

describe('users — privilege escalation', () => {
  it('SME A cannot escalate its own userType to admin', async () => {
    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'users', SME_A), {
        userType: 'admin',
      })
    )
  })

  it('SME A cannot escalate its own role field', async () => {
    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'users', SME_A), {
        role: 'admin',
      })
    )
  })

  it('SME A cannot update SME B user profile (IDOR)', async () => {
    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'users', SME_B), {
        email: 'hijacked@example.com',
      })
    )
  })

  it('SME A can update its own non-privileged profile fields (sanity)', async () => {
    await assertSucceeds(
      updateDoc(doc(firestoreAs(SME_A), 'users', SME_A), {
        displayName: 'Updated Name',
      })
    )
  })

  it('admin can escalate userType (sanity)', async () => {
    await assertSucceeds(
      updateDoc(doc(firestoreAs(ADMIN), 'users', SME_A), {
        userType: 'admin',
      })
    )
  })
})

describe('smeTenderIntelligence progress — tenant isolation', () => {
  const tenderId = 'tender-pi-1'

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'smeTenderIntelligence', SME_A, 'tenders', tenderId), {
        checklistProgress: { item1: true },
        ownerUid: SME_A,
      })
      await setDoc(doc(db, 'smeTenderIntelligence', SME_B, 'tenders', tenderId), {
        checklistProgress: { item1: false },
        ownerUid: SME_B,
      })
    })
  })

  it('SME A can read own progress', async () => {
    await assertSucceeds(
      getDoc(doc(firestoreAs(SME_A), 'smeTenderIntelligence', SME_A, 'tenders', tenderId))
    )
  })

  it('SME A cannot read SME B progress (IDOR)', async () => {
    await assertFails(
      getDoc(doc(firestoreAs(SME_A), 'smeTenderIntelligence', SME_B, 'tenders', tenderId))
    )
  })

  it('SME A can write own checklist progress', async () => {
    await assertSucceeds(
      setDoc(doc(firestoreAs(SME_A), 'smeTenderIntelligence', SME_A, 'tenders', tenderId), {
        checklistProgress: { item1: true, item2: false },
        ownerUid: SME_A,
      })
    )
  })

  it('SME A cannot write SME B progress (IDOR)', async () => {
    await assertFails(
      setDoc(doc(firestoreAs(SME_A), 'smeTenderIntelligence', SME_B, 'tenders', tenderId), {
        checklistProgress: { hijacked: true },
        ownerUid: SME_B,
      })
    )
  })

  it('unauthenticated cannot read progress', async () => {
    await assertFails(
      getDoc(doc(firestoreAs(null), 'smeTenderIntelligence', SME_A, 'tenders', tenderId))
    )
  })
})

describe('Youth Agent Workspace collections — IDOR matrix', () => {
  it('agent A cannot read agent B earnings ledger', async () => {
    const id = uid('ledger')
    await seed('agentEarningsLedger', id, {
      agentId: AGENT_B,
      amountCents: 1000,
      currency: 'ZAR',
      type: 'earned',
      immutable: true,
    })
    await assertFails(getDoc(doc(firestoreAs(AGENT_A), 'agentEarningsLedger', id)))
    await assertSucceeds(getDoc(doc(firestoreAs(AGENT_B), 'agentEarningsLedger', id)))
  })

  it('client cannot create or update earnings ledger (Admin SDK only)', async () => {
    const id = uid('ledger')
    await assertFails(
      setDoc(doc(firestoreAs(AGENT_A), 'agentEarningsLedger', id), {
        agentId: AGENT_A,
        amountCents: 99999,
        currency: 'ZAR',
        type: 'earned',
        immutable: true,
      })
    )
  })

  it('agent A cannot read agent B field report draft', async () => {
    const id = uid('draft')
    await seed('fieldReportDrafts', id, {
      agentId: AGENT_B,
      smeId: SME_A,
      requestId: 'req-1',
      status: 'draft',
    })
    await assertFails(getDoc(doc(firestoreAs(AGENT_A), 'fieldReportDrafts', id)))
    await assertSucceeds(getDoc(doc(firestoreAs(AGENT_B), 'fieldReportDrafts', id)))
    await assertSucceeds(getDoc(doc(firestoreAs(SME_A), 'fieldReportDrafts', id)))
  })

  it('client cannot write field report drafts or audit events', async () => {
    await assertFails(
      setDoc(doc(firestoreAs(AGENT_A), 'fieldReportDrafts', uid('d')), {
        agentId: AGENT_A,
        smeId: SME_A,
        requestId: 'r1',
        status: 'draft',
      })
    )
    await assertFails(
      setDoc(doc(firestoreAs(AGENT_A), 'agentWorkspaceAuditEvents', uid('a')), {
        actorUid: AGENT_A,
        type: 'message_sent',
      })
    )
  })

  it('assignment message readable only by sender or recipient', async () => {
    const id = uid('msg')
    await seed('assignmentMessages', id, {
      requestId: 'req-1',
      senderId: AGENT_A,
      recipientId: SME_A,
      body: 'hello',
    })
    await assertSucceeds(getDoc(doc(firestoreAs(AGENT_A), 'assignmentMessages', id)))
    await assertSucceeds(getDoc(doc(firestoreAs(SME_A), 'assignmentMessages', id)))
    await assertFails(getDoc(doc(firestoreAs(AGENT_B), 'assignmentMessages', id)))
  })
})
