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
    try {
      const { writeAuditEvent } = require('./privateTenderAuditService')
      await writeAuditEvent(
        {
          submissionId: id,
          organisationId: submission.organisationId || null,
          actorUid,
          actorType: 'founder',
          eventType: publish.created ? 'tender_published' : 'tender_publish_idempotent',
          fromStatus: submission.status,
          toStatus: 'published',
          metadata: { publishedTenderId: publish.tenderId },
        },
        deps
      )
    } catch {
      /* fail-soft */
    }
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
    try {
      const { writeAuditEvent } = require('./privateTenderAuditService')
      await writeAuditEvent(
        {
          submissionId: id,
          organisationId: submission.organisationId || null,
          actorUid,
          actorType: 'founder',
          eventType: 'tender_rejected',
          fromStatus: submission.status,
          toStatus: 'rejected',
        },
        deps
      )
    } catch {
      /* fail-soft */
    }
    return { submission: { ...submission, ...next } }
  }

  if (action === 'request_changes') {
    if (!note) {
      const err = new Error('Change request note is required')
      err.status = 400
      throw err
    }
    const category = sliceStr(opts.issueCategory || opts.category || '', 80) || null
    const reviewEntry = {
      at: ts,
      action: 'changes_requested',
      note,
      category,
      actorUid,
      actorEmail,
    }
    const next = sanitizeFirestoreData({
      status: 'changes_requested',
      reviewedAt: ts,
      reviewedByUid: actorUid,
      reviewedByEmail: actorEmail,
      changesRequestedNote: note,
      changesRequestedCategory: category,
      reviewHistory: [...(submission.reviewHistory || []), reviewEntry],
      updatedAt: ts,
      audit: [
        ...(submission.audit || []),
        { at: ts, action: 'changes_requested', actorUid, actorEmail, note },
      ],
    })
    await ref.set(next, { merge: true })
    try {
      const { writeAuditEvent } = require('./privateTenderAuditService')
      await writeAuditEvent(
        {
          submissionId: id,
          organisationId: submission.organisationId || null,
          actorUid,
          actorType: 'founder',
          eventType: 'changes_requested',
          fromStatus: submission.status,
          toStatus: 'changes_requested',
          metadata: { category },
        },
        deps
      )
    } catch {
      /* fail-soft */
    }
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
    try {
      const { writeAuditEvent } = require('./privateTenderAuditService')
      await writeAuditEvent(
        {
          submissionId: id,
          organisationId: submission.organisationId || null,
          actorUid,
          actorType: 'founder',
          eventType: 'founder_review_started',
          fromStatus: submission.status,
          toStatus: 'under_review',
        },
        deps
      )
    } catch {
      /* fail-soft */
    }
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

/* ─── Phase 2 organisation workspace helpers ─── */

const EDITABLE_STATUSES = new Set(['draft', 'changes_requested'])

function emptyDraftFields() {
  return {
    companyName: '',
    registrationNumber: '',
    website: '',
    contactPersonName: '',
    contactEmail: '',
    contactPhone: '',
    title: '',
    tenderReference: '',
    description: '',
    category: '',
    province: '',
    municipality: '',
    closingDate: '',
    closingTime: '',
    briefingRequired: true,
    briefingCompulsory: true,
    briefingDate: '',
    briefingTime: '',
    briefingVenue: '',
    briefingInstructions: '',
    registrationRequired: false,
    registrationInstructions: '',
    virtualBriefing: false,
    meetingLink: '',
    eligibilityRequirements: '',
    submissionInstructions: '',
    procurementContactName: '',
    procurementContactEmail: '',
    procurementContactPhone: '',
    tenderDocument: null,
    supportingDocuments: [],
  }
}

function applyDraftPatch(current, patch) {
  const next = { ...current }
  const keys = [
    'companyName',
    'registrationNumber',
    'website',
    'contactPersonName',
    'contactEmail',
    'contactPhone',
    'title',
    'tenderReference',
    'description',
    'category',
    'province',
    'municipality',
    'closingDate',
    'closingTime',
    'briefingDate',
    'briefingTime',
    'briefingVenue',
    'briefingInstructions',
    'registrationInstructions',
    'meetingLink',
    'eligibilityRequirements',
    'submissionInstructions',
    'procurementContactName',
    'procurementContactEmail',
    'procurementContactPhone',
  ]
  for (const key of keys) {
    if (patch[key] !== undefined) next[key] = sliceStr(patch[key], key === 'description' ? 8000 : 500)
  }
  if (patch.briefingRequired !== undefined) next.briefingRequired = Boolean(patch.briefingRequired)
  if (patch.briefingCompulsory !== undefined) {
    next.briefingCompulsory = Boolean(patch.briefingCompulsory)
  }
  if (patch.registrationRequired !== undefined) {
    next.registrationRequired = Boolean(patch.registrationRequired)
  }
  if (patch.virtualBriefing !== undefined) next.virtualBriefing = Boolean(patch.virtualBriefing)
  if (patch.tenderDocument !== undefined) next.tenderDocument = patch.tenderDocument || null
  if (patch.supportingDocuments !== undefined) {
    next.supportingDocuments = Array.isArray(patch.supportingDocuments)
      ? patch.supportingDocuments
      : []
  }
  return next
}

function sanitizeDraftSeed(seed = {}) {
  // Never accept trust/lifecycle fields from client seed payloads.
  const safe = applyDraftPatch(emptyDraftFields(), seed || {})
  delete safe.status
  delete safe.organisationId
  delete safe.createdByUid
  delete safe.publishedTenderId
  delete safe.publishedAt
  delete safe.reviewedAt
  delete safe.reviewedByUid
  delete safe.reviewedByEmail
  delete safe.submittedAt
  delete safe.trackingToken
  delete safe.id
  delete safe.audit
  delete safe.reviewHistory
  return safe
}

function assertOrgOwnership(submission, organisationId) {
  if (!organisationId) {
    const err = new Error('organisationId is required')
    err.status = 400
    throw err
  }
  if (!submission || submission.organisationId !== organisationId) {
    const err = new Error('Forbidden')
    err.status = 403
    throw err
  }
}

async function createOrgDraft(meta = {}, deps = {}) {
  const db = getDb(deps)
  const organisationId = sliceStr(meta.organisationId, 80)
  const createdByUid = sliceStr(meta.createdByUid, 128)
  if (!organisationId || !createdByUid) {
    const err = new Error('organisationId and createdByUid are required')
    err.status = 400
    throw err
  }
  const ts = nowIso(meta.now)
  const id = `pts-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const trackingToken = randomToken()
  const seeded = sanitizeDraftSeed(meta.seed || {})
  const record = sanitizeFirestoreData({
    id,
    trackingToken,
    ...seeded,
    // Trust fields always win over any seed content.
    status: 'draft',
    organisationId,
    createdByUid,
    companyName: sliceStr(
      seeded.companyName || meta.companyName || '',
      200
    ),
    contactPersonName: sliceStr(seeded.contactPersonName || '', 120),
    contactEmail: sliceStr(seeded.contactEmail || meta.createdByEmail || '', 320),
    submittedAt: null,
    submittedByUid: null,
    submittedByEmail: null,
    submittedIpHash: null,
    reviewedAt: null,
    reviewedByUid: null,
    reviewedByEmail: null,
    rejectionReason: null,
    changesRequestedNote: null,
    changesRequestedCategory: null,
    reviewHistory: [],
    publishedTenderId: null,
    publishedAt: null,
    duplicateFlags: [],
    audit: [
      {
        at: ts,
        action: 'tender_created',
        actorUid: createdByUid,
        actorEmail: meta.createdByEmail || null,
        note: null,
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  })
  await db.collection(COLLECTION).doc(id).set(record)
  try {
    const { writeAuditEvent } = require('./privateTenderAuditService')
    await writeAuditEvent(
      {
        submissionId: id,
        organisationId,
        actorUid: createdByUid,
        actorType: 'organisation_user',
        eventType: 'tender_created',
        fromStatus: null,
        toStatus: 'draft',
      },
      deps
    )
  } catch {
    /* fail-soft */
  }
  return record
}

async function updateOrgDraft(id, patch, meta = {}, deps = {}) {
  const db = getDb(deps)
  const ref = db.collection(COLLECTION).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) {
    const err = new Error('Submission not found')
    err.status = 404
    throw err
  }
  const submission = { id: snap.id, ...snap.data() }
  assertOrgOwnership(submission, meta.organisationId)
  if (!EDITABLE_STATUSES.has(submission.status)) {
    const err = new Error(`Cannot edit submission in status ${submission.status}`)
    err.status = 409
    throw err
  }
  const ts = nowIso(meta.now)
  const merged = applyDraftPatch(submission, patch || {})
  const next = sanitizeFirestoreData({
    ...merged,
    updatedAt: ts,
    audit: [
      ...(submission.audit || []),
      {
        at: ts,
        action: 'draft_updated',
        actorUid: meta.actorUid || null,
        actorEmail: meta.actorEmail || null,
        note: null,
      },
    ].slice(-50),
  })
  await ref.set(next, { merge: true })
  try {
    const { writeAuditEvent } = require('./privateTenderAuditService')
    await writeAuditEvent(
      {
        submissionId: id,
        organisationId: submission.organisationId || null,
        actorUid: meta.actorUid || null,
        actorType: 'organisation_user',
        eventType: 'draft_updated',
        fromStatus: submission.status,
        toStatus: submission.status,
      },
      deps
    )
  } catch {
    /* fail-soft */
  }
  return { ...submission, ...next }
}

async function submitOrgDraft(id, meta = {}, deps = {}) {
  const { canTransition } = require('./privateTenderStatusMachine')
  const db = getDb(deps)
  const ref = db.collection(COLLECTION).doc(String(id))

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) {
      const err = new Error('Submission not found')
      err.status = 404
      throw err
    }
    const submission = { id: snap.id, ...snap.data() }
    assertOrgOwnership(submission, meta.organisationId)
    // Idempotent: already submitted/in review
    if (
      submission.status === 'submitted' ||
      submission.status === 'under_review' ||
      submission.status === 'published'
    ) {
      return { submission, alreadySubmitted: true }
    }
    if (!canTransition(submission.status, 'submitted')) {
      const err = new Error(`Cannot submit from status ${submission.status}`)
      err.status = 409
      throw err
    }

    const ts = nowIso(meta.now)
    const isResubmit = submission.status === 'changes_requested'
    const next = sanitizeFirestoreData({
      status: 'submitted',
      submittedAt: submission.submittedAt || ts,
      submittedByUid: meta.actorUid || submission.submittedByUid || null,
      submittedByEmail: meta.actorEmail || submission.submittedByEmail || null,
      submittedIpHash: hashIp(meta.ip) || submission.submittedIpHash || null,
      lastSubmittedAt: ts,
      updatedAt: ts,
      audit: [
        ...(submission.audit || []),
        {
          at: ts,
          action: isResubmit ? 'tender_resubmitted' : 'tender_submitted',
          actorUid: meta.actorUid || null,
          actorEmail: meta.actorEmail || null,
          note: null,
        },
      ],
    })
    tx.set(ref, next, { merge: true })
    return {
      submission: { ...submission, ...next },
      alreadySubmitted: false,
      resubmitted: isResubmit,
    }
  }).then(async (result) => {
    try {
      const { writeAuditEvent } = require('./privateTenderAuditService')
      await writeAuditEvent(
        {
          submissionId: id,
          organisationId: result.submission.organisationId || null,
          actorUid: meta.actorUid || null,
          actorType: 'organisation_user',
          eventType: result.resubmitted ? 'tender_resubmitted' : 'tender_submitted',
          fromStatus: result.alreadySubmitted ? result.submission.status : 'draft',
          toStatus: 'submitted',
        },
        deps
      )
    } catch {
      /* fail-soft */
    }
    return result
  })
}

async function withdrawOrgSubmission(id, meta = {}, deps = {}) {
  const { canOrganisationWithdraw, canTransition } = require('./privateTenderStatusMachine')
  const db = getDb(deps)
  const ref = db.collection(COLLECTION).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) {
    const err = new Error('Submission not found')
    err.status = 404
    throw err
  }
  const submission = { id: snap.id, ...snap.data() }
  assertOrgOwnership(submission, meta.organisationId)
  if (!canOrganisationWithdraw(submission.status) || !canTransition(submission.status, 'withdrawn')) {
    const err = new Error('Withdrawal is not allowed for this status; contact Founder if published')
    err.status = 409
    throw err
  }
  if (submission.publishedTenderId) {
    const err = new Error('Published tenders require Founder intervention to cancel')
    err.status = 409
    throw err
  }
  const ts = nowIso(meta.now)
  const next = sanitizeFirestoreData({
    status: 'withdrawn',
    updatedAt: ts,
    withdrawnAt: ts,
    withdrawnByUid: meta.actorUid || null,
    audit: [
      ...(submission.audit || []),
      {
        at: ts,
        action: 'tender_withdrawn',
        actorUid: meta.actorUid || null,
        actorEmail: meta.actorEmail || null,
        note: sliceStr(meta.note || '', 500) || null,
      },
    ],
  })
  await ref.set(next, { merge: true })
  try {
    const { writeAuditEvent } = require('./privateTenderAuditService')
    await writeAuditEvent(
      {
        submissionId: id,
        organisationId: submission.organisationId || null,
        actorUid: meta.actorUid || null,
        actorType: 'organisation_user',
        eventType: 'tender_withdrawn',
        fromStatus: submission.status,
        toStatus: 'withdrawn',
      },
      deps
    )
  } catch {
    /* fail-soft */
  }
  return { ...submission, ...next }
}

async function duplicateOrgSubmission(id, meta = {}, deps = {}) {
  const source = await getSubmissionById(id, deps)
  if (!source) {
    const err = new Error('Submission not found')
    err.status = 404
    throw err
  }
  assertOrgOwnership(source, meta.organisationId)
  const seed = {
    companyName: source.companyName,
    registrationNumber: source.registrationNumber,
    website: source.website,
    contactPersonName: source.contactPersonName,
    contactEmail: source.contactEmail,
    contactPhone: source.contactPhone,
    title: source.title ? `${source.title} (copy)` : '',
    tenderReference: '',
    description: source.description,
    category: source.category,
    province: source.province,
    municipality: source.municipality,
    closingDate: '',
    closingTime: source.closingTime || '',
    briefingRequired: true,
    briefingCompulsory: true,
    briefingDate: '',
    briefingTime: source.briefingTime || '',
    briefingVenue: source.briefingVenue || '',
    briefingInstructions: source.briefingInstructions || '',
    registrationRequired: Boolean(source.registrationRequired),
    registrationInstructions: source.registrationInstructions || '',
    virtualBriefing: Boolean(source.virtualBriefing),
    meetingLink: '',
    eligibilityRequirements: source.eligibilityRequirements || '',
    submissionInstructions: source.submissionInstructions || '',
    procurementContactName: source.procurementContactName || '',
    procurementContactEmail: source.procurementContactEmail || '',
    procurementContactPhone: source.procurementContactPhone || '',
    tenderDocument: null,
    supportingDocuments: [],
  }
  const draft = await createOrgDraft(
    {
      organisationId: source.organisationId || meta.organisationId,
      createdByUid: meta.actorUid || meta.createdByUid,
      createdByEmail: meta.actorEmail,
      companyName: seed.companyName,
      seed,
      now: meta.now,
    },
    deps
  )
  try {
    const { writeAuditEvent } = require('./privateTenderAuditService')
    await writeAuditEvent(
      {
        submissionId: draft.id,
        organisationId: draft.organisationId,
        actorUid: meta.actorUid || null,
        actorType: 'organisation_user',
        eventType: 'tender_duplicated',
        fromStatus: null,
        toStatus: 'draft',
        metadata: { sourceSubmissionId: source.id },
      },
      deps
    )
  } catch {
    /* fail-soft */
  }
  return draft
}

async function listOrgSubmissions(organisationId, filters = {}, deps = {}) {
  const db = getDb(deps)
  const limit = Math.min(Number(filters.limit) || 50, 100)
  let query = db
    .collection(COLLECTION)
    .where('organisationId', '==', String(organisationId))
    .orderBy('updatedAt', 'desc')
    .limit(limit)

  if (filters.status) {
    query = db
      .collection(COLLECTION)
      .where('organisationId', '==', String(organisationId))
      .where('status', '==', String(filters.status))
      .orderBy('updatedAt', 'desc')
      .limit(limit)
  }

  const snap = await query.get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function getOrgDashboardCounts(organisationId, deps = {}) {
  const items = await listOrgSubmissions(organisationId, { limit: 100 }, deps)
  const counts = {
    draft: 0,
    under_review: 0,
    changes_requested: 0,
    published: 0,
    closing_soon: 0,
    closed: 0,
    submitted: 0,
    total: items.length,
  }
  const soon = Date.now() + 14 * 24 * 60 * 60 * 1000
  for (const item of items) {
    if (counts[item.status] !== undefined) counts[item.status] += 1
    if (item.status === 'submitted' || item.status === 'under_review') {
      /* under review bucket includes submitted awaiting Founder */
      if (item.status === 'submitted') counts.under_review += 0
    }
    if (
      (item.status === 'published' || item.status === 'submitted' || item.status === 'under_review') &&
      item.closingDate
    ) {
      const close = new Date(`${item.closingDate}T23:59:59+02:00`).getTime()
      if (close >= Date.now() && close <= soon) counts.closing_soon += 1
    }
    if (item.status === 'closed' || item.status === 'archived') counts.closed += 1
  }
  // Combine submitted into "under review" KPI for dashboard friendliness
  counts.under_review = counts.under_review + counts.submitted
  return { counts, recent: items.slice(0, 10) }
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
  createOrgDraft,
  updateOrgDraft,
  submitOrgDraft,
  withdrawOrgSubmission,
  duplicateOrgSubmission,
  listOrgSubmissions,
  getOrgDashboardCounts,
  EDITABLE_STATUSES,
}
