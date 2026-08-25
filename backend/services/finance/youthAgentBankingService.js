/**
 * Youth Agent banking profiles — server-authoritative.
 * Captured once on the YA profile; reused for all monthly EFT settlements.
 * Never log full account numbers.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const auditLogService = require('../auditLogService')

const COL = 'youthAgentBankingProfiles'
const HISTORY_COL = 'youthAgentBankingProfileHistory'

const ACCOUNT_TYPES = new Set(['cheque', 'savings', 'transmission', 'current', 'other'])

function nowIso() {
  return new Date().toISOString()
}

function maskAccountNumber(accountNumber) {
  const digits = String(accountNumber || '').replace(/\s+/g, '')
  if (!digits) return '—'
  if (digits.length <= 4) return `****${digits}`
  return `${'*'.repeat(Math.min(6, digits.length - 4))}${digits.slice(-4)}`
}

function normalizeAccountNumber(raw) {
  return String(raw || '').replace(/\s+/g, '').replace(/-/g, '')
}

function normalizeBranchCode(raw) {
  return String(raw || '').replace(/\s+/g, '').replace(/-/g, '')
}

function isComplete(profile) {
  if (!profile) return false
  const accountNumber = normalizeAccountNumber(profile.accountNumber)
  const branchCode = normalizeBranchCode(profile.branchCode)
  return Boolean(
    String(profile.accountHolderName || '').trim() &&
      String(profile.bankName || '').trim() &&
      accountNumber.length >= 5 &&
      accountNumber.length <= 20 &&
      /^\d+$/.test(accountNumber) &&
      String(profile.accountType || '').trim() &&
      ACCOUNT_TYPES.has(String(profile.accountType)) &&
      branchCode.length >= 4 &&
      branchCode.length <= 10 &&
      /^\d+$/.test(branchCode)
  )
}

function validateInput(body, { requireAccountNumber = true } = {}) {
  const accountHolderName = String(body.accountHolderName || '').trim().slice(0, 120)
  const bankName = String(body.bankName || '').trim().slice(0, 80)
  const rawAccount = body.accountNumber
  const accountNumberProvided =
    rawAccount !== undefined && rawAccount !== null && String(rawAccount).trim() !== ''
  const accountNumber = accountNumberProvided ? normalizeAccountNumber(rawAccount) : null
  const accountType = String(body.accountType || '').trim().toLowerCase()
  const branchCode = normalizeBranchCode(body.branchCode)
  const bankAccountNickname = body.bankAccountNickname
    ? String(body.bankAccountNickname).trim().slice(0, 60)
    : null
  const proofOfBankAccountRef = body.proofOfBankAccountRef
    ? String(body.proofOfBankAccountRef).trim().slice(0, 500)
    : null

  if (!accountHolderName) throw new Error('accountHolderName is required')
  if (!bankName) throw new Error('bankName is required')
  if (!ACCOUNT_TYPES.has(accountType)) {
    throw new Error('accountType must be cheque, savings, transmission, current, or other')
  }
  if (requireAccountNumber || accountNumberProvided) {
    if (!accountNumber || !/^\d{5,20}$/.test(accountNumber)) {
      throw new Error('accountNumber must be 5–20 digits')
    }
  }
  if (!/^\d{4,10}$/.test(branchCode)) {
    throw new Error('branchCode must be 4–10 digits')
  }

  return {
    accountHolderName,
    bankName,
    accountNumber,
    accountNumberProvided,
    accountType,
    branchCode,
    bankAccountNickname,
    proofOfBankAccountRef,
  }
}

function toPublic(profile) {
  if (!profile) return null
  return {
    youthAgentUid: profile.youthAgentUid,
    accountHolderName: profile.accountHolderName,
    bankName: profile.bankName,
    accountNumberMasked: maskAccountNumber(profile.accountNumber),
    accountType: profile.accountType,
    branchCode: profile.branchCode,
    bankAccountNickname: profile.bankAccountNickname || null,
    hasProofOfBankAccount: Boolean(profile.proofOfBankAccountRef),
    version: profile.version || 1,
    updatedAt: profile.updatedAt,
    isComplete: isComplete(profile),
  }
}

function toFounderView(profile) {
  if (!profile) return null
  return {
    ...toPublic(profile),
    accountNumber: profile.accountNumber,
    proofOfBankAccountRef: profile.proofOfBankAccountRef || null,
    createdAt: profile.createdAt,
    updatedBy: profile.updatedBy,
  }
}

function buildSnapshot(profile) {
  if (!isComplete(profile)) return null
  return {
    bankingProfileVersion: profile.version || 1,
    accountHolderName: profile.accountHolderName,
    bankName: profile.bankName,
    accountNumber: profile.accountNumber,
    accountType: profile.accountType,
    branchCode: profile.branchCode,
    accountNumberMasked: maskAccountNumber(profile.accountNumber),
    snapshottedAt: nowIso(),
  }
}

async function logBankingAudit(event) {
  // Never include full account numbers in audit payloads.
  const safe = { ...event }
  delete safe.accountNumber
  await auditLogService.logEvent({
    type: 'youth_agent_banking',
    ...safe,
    accountNumberMasked: event.accountNumberMasked || null,
    timestamp: nowIso(),
  })
}

async function getBankingProfile(youthAgentUid) {
  if (!youthAgentUid) return null
  const db = getFirestore()
  const snap = await db.collection(COL).doc(youthAgentUid).get()
  if (!snap.exists) return null
  return { youthAgentUid: snap.id, ...snap.data() }
}

async function upsertBankingProfile(youthAgentUid, body, { actorUid } = {}) {
  if (!youthAgentUid) throw new Error('youthAgentUid is required')
  if (actorUid && actorUid !== youthAgentUid) {
    throw new Error('Youth Agents may only update their own banking profile')
  }

  const db = getFirestore()
  const ref = db.collection(COL).doc(youthAgentUid)
  const ts = nowIso()

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const existing = snap.exists ? snap.data() : null
    const nextVersion = existing ? Number(existing.version || 1) + 1 : 1

    // Create requires account number; updates may omit it to keep the stored value.
    const validated = validateInput(body, { requireAccountNumber: !existing })
    const accountNumber = validated.accountNumberProvided
      ? validated.accountNumber
      : existing?.accountNumber
    if (!accountNumber) {
      throw new Error('accountNumber must be 5–20 digits')
    }

    if (existing) {
      const historyRef = db.collection(HISTORY_COL).doc()
      tx.set(
        historyRef,
        sanitizeFirestoreData({
          historyId: historyRef.id,
          youthAgentUid,
          version: existing.version || 1,
          accountHolderName: existing.accountHolderName,
          bankName: existing.bankName,
          accountNumber: existing.accountNumber,
          accountType: existing.accountType,
          branchCode: existing.branchCode,
          bankAccountNickname: existing.bankAccountNickname || null,
          proofOfBankAccountRef: existing.proofOfBankAccountRef || null,
          supersededAt: ts,
          supersededBy: actorUid || youthAgentUid,
          previousUpdatedAt: existing.updatedAt || null,
        })
      )
    }

    const record = sanitizeFirestoreData({
      youthAgentUid,
      accountHolderName: validated.accountHolderName,
      bankName: validated.bankName,
      accountNumber,
      accountType: validated.accountType,
      branchCode: validated.branchCode,
      bankAccountNickname: validated.bankAccountNickname,
      proofOfBankAccountRef:
        validated.proofOfBankAccountRef ?? existing?.proofOfBankAccountRef ?? null,
      version: nextVersion,
      createdAt: existing?.createdAt || ts,
      createdBy: existing?.createdBy || actorUid || youthAgentUid,
      updatedAt: ts,
      updatedBy: actorUid || youthAgentUid,
    })
    tx.set(ref, record)
    return {
      profile: record,
      created: !existing,
      previousVersion: existing?.version || null,
      accountNumberChanged: Boolean(validated.accountNumberProvided),
    }
  })

  await logBankingAudit({
    action: result.created ? 'banking_profile_created' : 'banking_profile_updated',
    entityId: youthAgentUid,
    youthAgentUid,
    actorUid: actorUid || youthAgentUid,
    version: result.profile.version,
    previousVersion: result.previousVersion,
    accountNumberMasked: maskAccountNumber(result.profile.accountNumber),
    bankName: result.profile.bankName,
    accountNumberChanged: result.accountNumberChanged,
  })

  return result
}

module.exports = {
  COL,
  HISTORY_COL,
  maskAccountNumber,
  isComplete,
  validateInput,
  toPublic,
  toFounderView,
  buildSnapshot,
  getBankingProfile,
  upsertBankingProfile,
}
