/**
 * Firestore security rules — briefingIntelligenceReports tenant isolation + field immutability.
 *
 * Runs against the real Firestore emulator via @firebase/rules-unit-testing.
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
      rules: fs.readFileSync(path.join(__dirname, '..', '..', '..', 'firestore.rules'), 'utf8'),
      host,
      port,
    },
  })
}, 30_000)

afterAll(async () => {
  await testEnv?.cleanup()
})

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

describe('briefingIntelligenceReports — tenant isolation + protected fields', () => {
  it('YA can create with own agentId', async () => {
    const reportDocId = uid('report')
    await assertSucceeds(
      setDoc(doc(firestoreAs(AGENT_A), 'briefingIntelligenceReports', reportDocId), {
        agentId: AGENT_A,
        smeId: SME_A,
        reportId: 'TB-BR-000001',
        status: 'awaiting_evidence',
      })
    )
  })

  it("YA cannot create with someone else's agentId", async () => {
    const reportDocId = uid('report')
    await assertFails(
      setDoc(doc(firestoreAs(AGENT_A), 'briefingIntelligenceReports', reportDocId), {
        agentId: AGENT_B,
        smeId: SME_A,
        reportId: 'TB-BR-000001',
        status: 'awaiting_evidence',
      })
    )
  })

  it('SME can read own reports (by smeId) but not others', async () => {
    const reportDocId = uid('report')
    await seed('briefingIntelligenceReports', reportDocId, {
      agentId: AGENT_A,
      smeId: SME_A,
      reportId: 'TB-BR-000002',
      status: 'awaiting_evidence',
      deliveredAt: null,
      pdfStorageRef: null,
      deliveryEmailId: null,
    })

    await assertSucceeds(getDoc(doc(firestoreAs(SME_A), 'briefingIntelligenceReports', reportDocId)))
    await assertFails(getDoc(doc(firestoreAs(SME_B), 'briefingIntelligenceReports', reportDocId)))
  })

  it('YA can read own reports (by agentId) but not others', async () => {
    const reportDocId = uid('report')
    await seed('briefingIntelligenceReports', reportDocId, {
      agentId: AGENT_A,
      smeId: SME_A,
      reportId: 'TB-BR-000003',
      status: 'awaiting_evidence',
      deliveredAt: null,
      pdfStorageRef: null,
      deliveryEmailId: null,
    })

    await assertSucceeds(getDoc(doc(firestoreAs(AGENT_A), 'briefingIntelligenceReports', reportDocId)))
    await assertFails(getDoc(doc(firestoreAs(AGENT_B), 'briefingIntelligenceReports', reportDocId)))
  })

  it('Admin can read all briefingIntelligenceReports', async () => {
    const reportDocIdA = uid('report')
    const reportDocIdB = uid('report')
    await seed('briefingIntelligenceReports', reportDocIdA, {
      agentId: AGENT_A,
      smeId: SME_A,
      reportId: 'TB-BR-000004',
      status: 'awaiting_evidence',
    })
    await seed('briefingIntelligenceReports', reportDocIdB, {
      agentId: AGENT_B,
      smeId: SME_B,
      reportId: 'TB-BR-000005',
      status: 'awaiting_evidence',
    })

    await assertSucceeds(getDoc(doc(firestoreAs(ADMIN), 'briefingIntelligenceReports', reportDocIdA)))
    await assertSucceeds(getDoc(doc(firestoreAs(ADMIN), 'briefingIntelligenceReports', reportDocIdB)))
  })

  it('YA cannot modify protected fields (smeId, reportId, deliveredAt, pdfStorageRef, deliveryEmailId)', async () => {
    const reportDocId = uid('report')
    await seed('briefingIntelligenceReports', reportDocId, {
      agentId: AGENT_A,
      smeId: SME_A,
      reportId: 'TB-BR-000006',
      status: 'draft_report',
      deliveredAt: null,
      pdfStorageRef: null,
      deliveryEmailId: null,
    })

    // smeId
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'briefingIntelligenceReports', reportDocId), { smeId: SME_B })
    )
    // reportId
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'briefingIntelligenceReports', reportDocId), { reportId: 'TB-BR-999999' })
    )
    // deliveredAt
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'briefingIntelligenceReports', reportDocId), {
        deliveredAt: new Date().toISOString(),
      })
    )
    // pdfStorageRef
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'briefingIntelligenceReports', reportDocId), { pdfStorageRef: 'x' })
    )
    // deliveryEmailId
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'briefingIntelligenceReports', reportDocId), { deliveryEmailId: 'y' })
    )
  })

  it('unauthenticated cannot access', async () => {
    const reportDocId = uid('report')
    await seed('briefingIntelligenceReports', reportDocId, {
      agentId: AGENT_A,
      smeId: SME_A,
      reportId: 'TB-BR-000007',
      status: 'awaiting_evidence',
    })

    await assertFails(getDoc(doc(firestoreAs(null), 'briefingIntelligenceReports', reportDocId)))
    await assertFails(
      setDoc(doc(firestoreAs(null), 'briefingIntelligenceReports', uid('report')), {
        agentId: AGENT_A,
        smeId: SME_A,
        reportId: 'TB-BR-000008',
        status: 'awaiting_evidence',
      })
    )
  })
})

