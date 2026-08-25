/**
 * Private tender submission intake + Founder publish workflow (Admin SDK).
 */
const crypto = require('crypto')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const { createEmptyTenderBriefing, contentHash } = require('./tenderModel')
const { getStorage } = require('./storageAdapter')

const COLLECTION = 'privateTenderSubmissions'

function getDb(deps = {}) {
  if (deps.db) return deps.db
  const { getFirestore } = require('../config/firebaseAdmin')
  return getFirestore()
}

function nowIso(now) {
  return (now || new Date()).toISOString()
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex')
}

function hashIp(ip) {
  if (!ip) return null
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 32)
}

function sliceStr(value, max) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function normalizeRef(companyName, tenderReference) {
  return `${companyName}|${tenderReference}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function toPublicStatus(doc) {
  return {
    id: doc.id,
    trackingToken: doc.trackingToken,
    status: doc.status,
    title: doc.title,
    tenderReference: doc.tenderReference,
    companyName: doc.companyName,
    submittedAt: doc.submittedAt,
    publishedTenderId: doc.publishedTenderId || null,
    rejectionReason: doc.status === 'rejected' ? doc.rejectionReason || null : null,
    changesRequestedNote:
      doc.status === 'changes_requested' ? doc.changesRequestedNote || null : null,
  }
}

async function findLikelyDuplicates(db, companyName, tenderReference, closingDate) {
  const flags = []
  const key = normalizeRef(companyName, tenderReference)
  try {
    const snap = await db
      .collection(COLLECTION)
      .where('tenderReference', '==', tenderReference)
      .limit(10)
      .get()
    for (const doc of snap.docs) {
      const data = doc.data() || {}
      if (normalizeRef(data.companyName || '', data.tenderReference || '') === key) {
        flags.push(`duplicate_submission:${doc.id}`)
      }
      if (
        String(data.companyName || '')
          .toLowerCase()
          .trim() === companyName.toLowerCase().trim() &&
        data.closingDate === closingDate
      ) {
        flags.push(`same_company_closing:${doc.id}`)
      }
    }
  } catch {
    /* non-blocking — index may be missing in local */
  }

  try {
    const storage = getStorage()
    const existing = await storage.getTenderById(tenderReference)
    if (existing && existing.sourceType === 'private') {
      flags.push(`duplicate_published:${existing.id}`)
    }
  } catch {
    /* non-blocking */
  }

  return [...new Set(flags)]
}

function buildSubmissionRecord(id, trackingToken, value, meta) {
  const submittedAt = nowIso(meta.now)
  return sanitizeFirestoreData({
    id,
    trackingToken,
    status: 'submitted',
    companyName: value.companyName,
    registrationNumber: value.registrationNumber || '',
    website: value.website || '',
    contactPersonName: value.contactPersonName,
    contactEmail: value.contactEmail,
    contactPhone: value.contactPhone || '',
    title: value.title,
    tenderReference: value.tenderReference,
    description: value.description,
    category: value.category,
    province: value.province,
    municipality: value.municipality || '',
    closingDate: value.closingDate,
    closingTime: value.closingTime || '',
    briefingRequired: true,
    briefingCompulsory: true,
    briefingDate: value.briefingDate,
    briefingTime: value.briefingTime,
    briefingVenue: value.briefingVenue,
    briefingInstructions: value.briefingInstructions || '',
    registrationRequired: Boolean(value.registrationRequired),
    registrationInstructions: value.registrationInstructions || '',
    virtualBriefing: Boolean(value.virtualBriefing),
    meetingLink: value.meetingLink || '',
    eligibilityRequirements: value.eligibilityRequirements || '',
    submissionInstructions: value.submissionInstructions || '',
    procurementContactName: value.procurementContactName || '',
    procurementContactEmail: value.procurementContactEmail || '',
    procurementContactPhone: value.procurementContactPhone || '',
    tenderDocument: value.tenderDocument,
    supportingDocuments: value.supportingDocuments || [],
    submittedAt,
    submittedByUid: meta.submittedByUid || null,
    submittedByEmail: meta.submittedByEmail || null,
    submittedIpHash: hashIp(meta.ip),
    reviewedAt: null,
    reviewedByUid: null,
    reviewedByEmail: null,
    rejectionReason: null,
    changesRequestedNote: null,
    publishedTenderId: null,
    publishedAt: null,
    duplicateFlags: meta.duplicateFlags || [],
    audit: [
      {
        at: submittedAt,
        action: 'submitted',
        actorUid: meta.submittedByUid || null,
        actorEmail: meta.submittedByEmail || value.contactEmail,
        note: null,
      },
    ],
    createdAt: submittedAt,
    updatedAt: submittedAt,
  })
}

async function createSubmission(value, meta = {}, deps = {}) {
  const db = getDb(deps)
  const id = `pts-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const trackingToken = randomToken()
  const duplicateFlags = await findLikelyDuplicates(
    db,
    value.companyName,
    value.tenderReference,
    value.closingDate
  )
  const record = buildSubmissionRecord(id, trackingToken, value, {
    ...meta,
    duplicateFlags,
  })
  await db.collection(COLLECTION).doc(id).set(record)
  return record
}

async function getSubmissionById(id, deps = {}) {
  const db = getDb(deps)
  const snap = await db.collection(COLLECTION).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() }
}

async function getSubmissionByTrackingToken(token, deps = {}) {
  const db = getDb(deps)
  const snap = await db
    .collection(COLLECTION)
    .where('trackingToken', '==', String(token || ''))
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() }
}

async function listSubmissions(filters = {}, deps = {}) {
  const db = getDb(deps)
  let query = db.collection(COLLECTION).orderBy('submittedAt', 'desc').limit(100)
  if (filters.status) {
    query = db
      .collection(COLLECTION)
      .where('status', '==', filters.status)
      .orderBy('submittedAt', 'desc')
      .limit(100)
  }
  const snap = await query.get()
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (filters.q) {
    const q = String(filters.q).toLowerCase()
    items = items.filter((item) => {
      const hay = `${item.companyName} ${item.title} ${item.tenderReference} ${item.province}`.toLowerCase()
      return hay.includes(q)
    })
  }
  return items
}

function mapToCanonicalTender(submission, publishedTenderId, now) {
  const ts = nowIso(now)
  const id = publishedTenderId || submission.publishedTenderId || `priv-${submission.id}`
  const documents = [
    {
      id: 'tender-document',
      title: submission.tenderDocument?.fileName || 'Tender document',
      url: `/api/tenders/${id}/documents/tender-document`,
      format: submission.tenderDocument?.contentType || 'application/pdf',
      datePublished: submission.submittedAt || ts,
    },
    ...((submission.supportingDocuments || []).map((doc, index) => ({
      id: `supporting-${index + 1}`,
      title: doc.fileName || `Supporting document ${index + 1}`,
      url: `/api/tenders/${id}/documents/supporting-${index + 1}`,
      format: doc.contentType || 'application/octet-stream',
      datePublished: doc.uploadedAt || ts,
    }))),
  ]

  const requirements = []
  if (submission.eligibilityRequirements) requirements.push(submission.eligibilityRequirements)
  if (submission.submissionInstructions) {
    requirements.push(`Submission instructions: ${submission.submissionInstructions}`)
  }
  if (submission.briefingInstructions) {
    requirements.push(`Briefing instructions: ${submission.briefingInstructions}`)
  }

  const tender = createEmptyTenderBriefing({
    id,
    ocid: `private-${submission.id}`,
    tenderNumber: submission.tenderReference,
    title: submission.title,
    description: submission.description,
    department: submission.companyName,
    buyer: submission.companyName,
    province: submission.province,
    category: submission.category,
    industrySector: submission.category,
    industryConfidence: 1,
    procurementMethod: 'private_sector',
    status: 'active',
    publishedDate: ts.slice(0, 10),
    closingDate: submission.closingDate,
    briefingDate: submission.briefingDate,
    briefingTime: submission.briefingTime,
    briefingVenue: submission.briefingVenue,
    briefingCompulsory: true,
    briefingConfidence: 1,
    matchedBriefingTerms: ['compulsory', 'private sector'],
    contactPerson: submission.procurementContactName || submission.contactPersonName || '',
    contactEmail: submission.procurementContactEmail || submission.contactEmail || '',
    contactPhone: submission.procurementContactPhone || submission.contactPhone || '',
    meetingLink: submission.meetingLink || '',
    documents,
    detailUrl: `/tenders/${id}`,
    summary: String(submission.description || '').slice(0, 280),
    requirements,
    keyDates: [
      {
        label: 'Compulsory briefing',
        date: submission.briefingDate,
        time: submission.briefingTime,
      },
      {
        label: 'Closing',
        date: submission.closingDate,
        time: submission.closingTime || undefined,
      },
    ],
    history: [
      {
        field: 'published',
        from: null,
        to: 'private_sector',
        changedAt: ts,
      },
    ],
    source: 'company_submission',
    sourceType: 'private',
    visibility: 'public',
    privateSubmissionId: submission.id,
    lastSyncedAt: ts,
    scrapedAt: ts,
    deliveryLocation: submission.municipality || submission.briefingVenue || '',
  })
  tender.contentHash = contentHash(tender)
  return tender
}

async function publishSubmission(submission, actor, deps = {}) {
  if (submission.publishedTenderId && (submission.status === 'published' || submission.status === 'approved')) {
    return {
      tenderId: submission.publishedTenderId,
      created: false,
      tender: await getStorage().getTenderById(submission.publishedTenderId),
    }
  }

  const tenderId = submission.publishedTenderId || `priv-${submission.id}`
  const tender = mapToCanonicalTender(submission, tenderId, deps.now)
  await getStorage().upsertTenders([tender])
  return { tenderId, created: true, tender }
}

async function reviewSubmission(id, action, opts = {}, deps = {}) {
  const db = getDb(deps)
  const ref = db.collection(COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    const err = new Error('Submission not found')
    err.status = 404
    throw err
  }

  const submission = { id: snap.id, ...snap.data() }
  const ts = nowIso(deps.now)
  const note = sliceStr(opts.note || opts.rejectionReason || '', 2000)
  const actorUid = opts.actorUid || null
  const actorEmail = opts.actorEmail || null

  if (action === 'approve') {
    const publish = await publishSubmission(submission, { uid: actorUid, email: actorEmail }, deps)
    const next = sanitizeFirestoreData({
      status: 'published',
      reviewedAt: ts,
      reviewedByUid: actorUid,
      reviewedByEmail: actorEmail,
      rejectionReason: null,
      changesRequestedNote: null,
      publishedTenderId: publish.tenderId,
      publishedAt: submission.publishedAt || ts,
      updatedAt: ts,
      audit: [
        ...(submission.audit || []),
        {
          at: ts,
          action: publish.created ? 'approved_and_published' : 'approve_idempotent',
          actorUid,
          actorEmail,
          note: note || null,
        },
      ],
    })
    await ref.set(next, { merge: true })
    return {
      submission: { ...submission, ...next },
      publishedTenderId: publish.tenderId,
      created: publish.created,
    }
  }

  if (action === 'reject') {
    if (!note) {
      const err = new Error('Rejection reason is required')
      err.status = 400
      throw err
    }
    const next = sanitizeFirestoreData({
      status: 'rejected',
      reviewedAt: ts,
      reviewedByUid: actorUid,
      reviewedByEmail: actorEmail,
      rejectionReason: note,
      updatedAt: ts,
      audit: [
        ...(submission.audit || []),
        { at: ts, action: 'rejected', actorUid, actorEmail, note },
      ],
    })
    await ref.set(next, { merge: true })
    return { submission: { ...submission, ...next } }
  }

  if (action === 'request_changes') {
    if (!note) {
      const err = new Error('Change request note is required')
      err.status = 400
      throw err
    }
    const next = sanitizeFirestoreData({
      status: 'changes_requested',
      reviewedAt: ts,
      reviewedByUid: actorUid,
      reviewedByEmail: actorEmail,
      changesRequestedNote: note,
      updatedAt: ts,
      audit: [
        ...(submission.audit || []),
        { at: ts, action: 'changes_requested', actorUid, actorEmail, note },
      ],
    })
    await ref.set(next, { merge: true })
    return { submission: { ...submission, ...next } }
  }

  if (action === 'under_review') {
    const next = sanitizeFirestoreData({
      status: 'under_review',
      reviewedAt: ts,
      reviewedByUid: actorUid,
      reviewedByEmail: actorEmail,
      updatedAt: ts,
      audit: [
        ...(submission.audit || []),
        { at: ts, action: 'under_review', actorUid, actorEmail, note: note || null },
      ],
    })
    await ref.set(next, { merge: true })
    return { submission: { ...submission, ...next } }
  }

  const err = new Error('Unsupported review action')
  err.status = 400
  throw err
}

async function uploadPrivateTenderDocument({
  buffer,
  fileName,
  contentType,
  kind = 'tender_document',
  submissionDraftId,
}) {
  const {
    getStorageBucket,
  } = require('./integrations/firebaseStorageService')
  const bucket = getStorageBucket()
  if (!bucket) {
    const err = new Error('Document storage is not configured')
    err.status = 503
    throw err
  }

  const safeName = String(fileName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
  const draftId = submissionDraftId || `draft-${Date.now()}`
  const objectPath = `private-tender-submissions/${draftId}/${kind}/${Date.now()}-${safeName}`
  const file = bucket.file(objectPath)
  await file.save(buffer, {
    metadata: { contentType: contentType || 'application/octet-stream' },
    resumable: false,
  })

  return {
    fileName: safeName,
    contentType: contentType || 'application/octet-stream',
    sizeBytes: buffer.length,
    storagePath: objectPath,
    uploadedAt: new Date().toISOString(),
    kind: kind === 'supporting' ? 'supporting' : 'tender_document',
  }
}

async function getSignedDocumentUrl(storagePath, expiresMs = 15 * 60 * 1000) {
  const { getStorageBucket } = require('./integrations/firebaseStorageService')
  const bucket = getStorageBucket()
  if (!bucket || !storagePath) return null
  const file = bucket.file(storagePath)
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresMs,
  })
  return url
}

module.exports = {
  COLLECTION,
  createSubmission,
  getSubmissionById,
  getSubmissionByTrackingToken,
  listSubmissions,
  reviewSubmission,
  publishSubmission,
  mapToCanonicalTender,
  toPublicStatus,
  uploadPrivateTenderDocument,
  getSignedDocumentUrl,
  findLikelyDuplicates,
  normalizeRef,
}
