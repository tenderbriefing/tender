import type { Firestore } from 'firebase-admin/firestore'
import { OUTREACH_SUPPRESSIONS } from './types'
import { normaliseSuppressionEmail } from './unsubscribeToken'

export type SuppressionReason = 'unsubscribe' | 'hard_bounce' | 'complaint' | 'manual'

export async function isEmailSuppressed(
  db: Firestore,
  email: string
): Promise<boolean> {
  const normalisedEmail = normaliseSuppressionEmail(email)
  if (!normalisedEmail) return false
  const snap = await db.collection(OUTREACH_SUPPRESSIONS).doc(normalisedEmail).get()
  return snap.exists
}

export async function listSuppressedAmong(
  db: Firestore,
  emails: string[]
): Promise<Set<string>> {
  const out = new Set<string>()
  const unique = Array.from(new Set(emails.map(normaliseSuppressionEmail).filter(Boolean)))
  // Firestore getAll in chunks of 100
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)
    const refs = chunk.map((e) => db.collection(OUTREACH_SUPPRESSIONS).doc(e))
    const snaps = await db.getAll(...refs)
    for (const s of snaps) {
      if (s.exists) out.add(s.id)
    }
  }
  return out
}

export async function upsertEmailSuppression(
  db: Firestore,
  email: string,
  reason: SuppressionReason,
  source: string
): Promise<void> {
  const normalisedEmail = normaliseSuppressionEmail(email)
  if (!normalisedEmail) return
  const ref = db.collection(OUTREACH_SUPPRESSIONS).doc(normalisedEmail)
  const existing = await ref.get()
  if (existing.exists) {
    await ref.set(
      {
        updatedAt: new Date().toISOString(),
        reason,
        source,
      },
      { merge: true }
    )
    return
  }
  await ref.set({
    normalisedEmail,
    reason,
    source,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}
