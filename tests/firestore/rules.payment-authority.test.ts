/**
 * P0 payment / revenue authority — Firestore rules attack-path matrix.
 *
 * Proves authenticated SMEs and Youth Agents cannot manufacture free bookings,
 * fee snapshots, or paid-equivalent entitlement via the client SDK.
 *
 * Run: npm run test:firestore-rules-emulator
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
import { doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'

const PROJECT_ID = 'demo-tenderbriefing-payment-authority'

const SME_A = 'sme-pay-a'
const AGENT_A = 'agent-pay-a'
const ADMIN = 'admin-pay'

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
      rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
      host,
      port,
    },
  })
}, 30_000)

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await seed('users', SME_A, { userType: 'sme', email: 'sme-pay-a@example.com' })
  await seed('users', AGENT_A, { userType: 'youth-agent', email: 'agent-pay-a@example.com' })
  await seed('users', ADMIN, { userType: 'admin', email: 'admin-pay@example.com' })
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

async function seed(collectionName: string, docId: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionName, docId), data)
  })
}

function firestoreAs(actorUid: string | null): Firestore {
  const ctx = actorUid ? testEnv.authenticatedContext(actorUid) : testEnv.unauthenticatedContext()
  return ctx.firestore()
}

describe('P0 payment authority — attendanceRequests client attacks', () => {
  it('ATTACK 1: SME cannot create attendanceRequest with paymentStatus=not_required', async () => {
    await assertFails(
      setDoc(doc(firestoreAs(SME_A), 'attendanceRequests', uid('atk1')), {
        smeId: SME_A,
        paymentStatus: 'not_required',
        status: 'pending',
        briefingPriceCents: 0,
      })
    )
  })

  it('ATTACK 2: SME cannot create attendanceRequest with amount=100 cents', async () => {
    await assertFails(
      setDoc(doc(firestoreAs(SME_A), 'attendanceRequests', uid('atk2')), {
        smeId: SME_A,
        paymentStatus: 'pending',
        status: 'pending',
        paymentAmount: 100,
        quotedFee: 100,
        briefingPriceCents: 100,
      })
    )
  })

  it('ATTACK 3: SME cannot create with injected fee snapshot fields', async () => {
    await assertFails(
      setDoc(doc(firestoreAs(SME_A), 'attendanceRequests', uid('atk3')), {
        smeId: SME_A,
        paymentStatus: 'pending',
        status: 'pending',
        feeSnapshot: { cents: 100 },
        pricingVersion: 'attacker-v1',
        briefingPriceCents: 100,
      })
    )
  })

  it('ATTACK 4: SME cannot update unpaid → paid', async () => {
    const requestId = uid('atk4')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      paymentStatus: 'pending',
      status: 'pending',
      paymentAmount: 34900,
      briefingPriceCents: 34900,
    })
    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId), {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
      })
    )
  })

  it('ATTACK 5: SME cannot update unpaid → not_required', async () => {
    const requestId = uid('atk5')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      paymentStatus: 'pending',
      status: 'pending',
      paymentAmount: 34900,
    })
    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId), {
        paymentStatus: 'not_required',
      })
    )
  })

  it('ATTACK 6: SME cannot inject PayFast verification fields', async () => {
    const requestId = uid('atk6')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      paymentStatus: 'pending',
      status: 'pending',
      paymentAmount: 34900,
      payfastPaymentId: null,
    })
    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId), {
        payfastPaymentId: 'PF-FORGED-123',
        paymentReference: 'TB-REQ-forged',
        paidAt: new Date().toISOString(),
      })
    )
  })

  it('ATTACK 7: SME cannot change authoritative price after creation', async () => {
    const requestId = uid('atk7')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      paymentStatus: 'pending',
      status: 'pending',
      paymentAmount: 34900,
      quotedFee: 34900,
      briefingPriceCents: 34900,
      pricingVersion: '2026-08-v349',
    })
    await assertFails(
      updateDoc(doc(firestoreAs(SME_A), 'attendanceRequests', requestId), {
        briefingPriceCents: 100,
        paymentAmount: 100,
        quotedFee: 100,
      })
    )
  })

  it('ATTACK 8: Youth Agent cannot manipulate payment fields', async () => {
    const requestId = uid('atk8')
    await seed('attendanceRequests', requestId, {
      smeId: SME_A,
      agentId: AGENT_A,
      assignedAgentId: AGENT_A,
      paymentStatus: 'pending',
      status: 'assigned',
      paymentAmount: 34900,
      briefingPriceCents: 34900,
    })
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', requestId), {
        paymentStatus: 'paid',
      })
    )
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', requestId), {
        paymentStatus: 'not_required',
      })
    )
    await assertFails(
      updateDoc(doc(firestoreAs(AGENT_A), 'attendanceRequests', requestId), {
        briefingPriceCents: 100,
        paymentAmount: 100,
      })
    )
  })

  it('ATTACK 9: Unauthenticated user cannot create attendanceRequest', async () => {
    await assertFails(
      setDoc(doc(firestoreAs(null), 'attendanceRequests', uid('atk9')), {
        smeId: 'anyone',
        paymentStatus: 'pending',
        status: 'pending',
      })
    )
  })

  it('ATTACK 10: Legitimate Admin SDK (rules-disabled) booking create succeeds', async () => {
    const requestId = uid('atk10')
    await assertSucceeds(
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'attendanceRequests', requestId), {
          smeId: SME_A,
          paymentStatus: 'pending',
          status: 'pending',
          paymentAmount: 34900,
          briefingPriceCents: 34900,
          quotedFee: 34900,
          currency: 'ZAR',
          pricingVersion: '2026-08-v349',
        })
      })
    )
  })

  it('ATTACK 13: Forged not_required cannot be created by SME client', async () => {
    await assertFails(
      setDoc(doc(firestoreAs(SME_A), 'attendanceRequests', uid('atk13')), {
        smeId: SME_A,
        paymentStatus: 'not_required',
        status: 'pending',
        paymentExemptionAuthorized: true,
      })
    )
  })
})
