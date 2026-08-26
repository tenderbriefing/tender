/**
 * Private-sector organisations (Phase 2) — Admin SDK only.
 */
const crypto = require('crypto')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const COLLECTION = 'privateOrganisations'

const ORG_TYPES = new Set(['private_company', 'nonprofit', 'soe', 'other'])

function getDb(deps = {}) {
  if (deps.db) return deps.db
  const { getFirestore } = require('../config/firebaseAdmin')
  return getFirestore()
}

function nowIso(now) {
  return (now || new Date()).toISOString()
}

function sliceStr(value, max) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function normalizeEmail(email) {
  return sliceStr(email, 320).toLowerCase()
}

function buildOrgRecord(id, input, meta) {
  const ts = nowIso(meta.now)
  const orgType = ORG_TYPES.has(input.organisationType) ? input.organisationType : 'private_company'
  return sanitizeFirestoreData({
    id,
    legalName: sliceStr(input.legalName, 200),
    tradingName: sliceStr(input.tradingName || '', 200),
    registrationNumber: sliceStr(input.registrationNumber || '', 64),
    website: sliceStr(input.website || '', 300),
    organisationType: orgType,
    industry: sliceStr(input.industry || '', 120),
    address: {
      line1: sliceStr(input.address?.line1 || '', 200),
      line2: sliceStr(input.address?.line2 || '', 200),
      city: sliceStr(input.address?.city || '', 120),
      province: sliceStr(input.address?.province || '', 80),
      postalCode: sliceStr(input.address?.postalCode || '', 32),
      country: sliceStr(input.address?.country || 'South Africa', 80) || 'South Africa',
    },
    primaryContactName: sliceStr(input.primaryContactName, 120),
    primaryContactEmail: normalizeEmail(input.primaryContactEmail),
    primaryContactPhone: sliceStr(input.primaryContactPhone || '', 40),
    status: 'active',
    verificationStatus: 'unverified',
    createdBy: meta.createdBy,
    createdAt: ts,
    updatedAt: ts,
  })
}

function assertCreateInput(input) {
  const errors = []
  if (!sliceStr(input?.legalName, 200)) errors.push('legalName is required')
  if (!sliceStr(input?.primaryContactName, 120)) errors.push('primaryContactName is required')
  if (!normalizeEmail(input?.primaryContactEmail)) errors.push('primaryContactEmail is required')
  if (errors.length) {
    const err = new Error(errors.join('; '))
    err.status = 400
    err.issues = errors
    throw err
  }
}

async function createOrganisation(input, meta = {}, deps = {}) {
  assertCreateInput(input)
  const db = getDb(deps)
  const id = `porg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const record = buildOrgRecord(id, input, meta)
  await db.collection(COLLECTION).doc(id).set(record)
  return record
}

async function getOrganisationById(id, deps = {}) {
  if (!id) return null
  const db = getDb(deps)
  const snap = await db.collection(COLLECTION).doc(String(id)).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() }
}

/**
 * Organisation profile patch. Never allows self-setting verificationStatus=verified.
 */
async function updateOrganisation(id, patch, meta = {}, deps = {}) {
  const db = getDb(deps)
  const ref = db.collection(COLLECTION).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) {
    const err = new Error('Organisation not found')
    err.status = 404
    throw err
  }
  const current = snap.data() || {}
  const ts = nowIso(meta.now)
  const next = { ...current }

  if (patch.legalName !== undefined) next.legalName = sliceStr(patch.legalName, 200)
  if (patch.tradingName !== undefined) next.tradingName = sliceStr(patch.tradingName, 200)
  if (patch.registrationNumber !== undefined) {
    next.registrationNumber = sliceStr(patch.registrationNumber, 64)
  }
  if (patch.website !== undefined) next.website = sliceStr(patch.website, 300)
  if (patch.organisationType !== undefined && ORG_TYPES.has(patch.organisationType)) {
    next.organisationType = patch.organisationType
  }
  if (patch.industry !== undefined) next.industry = sliceStr(patch.industry, 120)
  if (patch.primaryContactName !== undefined) {
    next.primaryContactName = sliceStr(patch.primaryContactName, 120)
  }
  if (patch.primaryContactEmail !== undefined) {
    next.primaryContactEmail = normalizeEmail(patch.primaryContactEmail)
  }
  if (patch.primaryContactPhone !== undefined) {
    next.primaryContactPhone = sliceStr(patch.primaryContactPhone, 40)
  }
  if (patch.address && typeof patch.address === 'object') {
    next.address = {
      ...(current.address || {}),
      line1: sliceStr(patch.address.line1 ?? current.address?.line1, 200),
      line2: sliceStr(patch.address.line2 ?? current.address?.line2, 200),
      city: sliceStr(patch.address.city ?? current.address?.city, 120),
      province: sliceStr(patch.address.province ?? current.address?.province, 80),
      postalCode: sliceStr(patch.address.postalCode ?? current.address?.postalCode, 32),
      country: sliceStr(patch.address.country ?? current.address?.country ?? 'South Africa', 80),
    }
  }

  // Trust fields: only Founder (meta.allowVerificationWrite) may change verification/status.
  if (meta.allowVerificationWrite) {
    if (patch.verificationStatus !== undefined) {
      next.verificationStatus = sliceStr(patch.verificationStatus, 40)
    }
    if (patch.status !== undefined) next.status = sliceStr(patch.status, 40)
  } else if (
    patch.verificationStatus !== undefined ||
    patch.status === 'suspended' ||
    patch.status === 'pending'
  ) {
    // Ignore or reset verification if identity fields change meaningfully
    if (
      patch.legalName !== undefined &&
      sliceStr(patch.legalName, 200) !== sliceStr(current.legalName, 200)
    ) {
      if (current.verificationStatus === 'verified') {
        next.verificationStatus = 'pending'
      }
    }
  }

  if (!next.legalName) {
    const err = new Error('legalName is required')
    err.status = 400
    throw err
  }

  next.updatedAt = ts
  const cleaned = sanitizeFirestoreData(next)
  await ref.set(cleaned, { merge: true })
  return { id, ...cleaned }
}

module.exports = {
  COLLECTION,
  createOrganisation,
  getOrganisationById,
  updateOrganisation,
}
