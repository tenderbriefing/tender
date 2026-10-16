/**
 * Phase 11 — Ops client report production.
 * Draft → edit → approve → PDF/DOCX → REPORT READY.
 * NEVER emails the client.
 */
const crypto = require('crypto')
const { getStorage } = require('../storageAdapter')
const { getFirebaseAdmin } = require('../../config/firebaseAdmin')
const auditLogService = require('../auditLogService')
const {
  buildReportDraft,
  applySectionEdits,
  regenerateSection,
  assertNoInternalLeakage,
} = require('./reportDraftBuilder')
const { renderClientReportPdf } = require('./clientReportPdf')
const { deriveManualOpsStage } = require('../../domain/manualBriefingOps')
const opsLifecycle = require('./opsLifecycleService')

function renderClientReportDocx(input) {
  // Lazy-load so Next/webpack does not eagerly analyse docx dynamic requires
  return require('./clientReportDocx').renderClientReportDocx(input)
}

const REPORTS_COLLECTION = 'opsReportVersions'

async function getRequest(requestId) {
  return opsLifecycle.getRequest(requestId)
}

async function saveRequest(request) {
  return opsLifecycle.saveRequest(request)
}

function nextVersionNumber(existing = []) {
  const nums = existing.map((v) => Number(v.version) || 0)
  return (nums.length ? Math.max(...nums) : 0) + 1
}

async function listVersions(requestId) {
  try {
    const db = getFirebaseAdmin().firestore()
    const snap = await db
      .collection(REPORTS_COLLECTION)
      .where('requestId', '==', requestId)
      .limit(50)
      .get()
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    rows.sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
    return rows
  } catch {
    const storage = getStorage()
    if (typeof storage.getOpsReportVersions === 'function') {
      return storage.getOpsReportVersions(requestId)
    }
    // JSON fallback: embed on request
    const req = await getRequest(requestId)
    return Array.isArray(req?.opsReportVersions) ? req.opsReportVersions : []
  }
}

/** Firestore rejects `undefined` field values — strip recursively before write. */
function stripUndefined(value) {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object') return value
  if (Buffer.isBuffer(value)) return value
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)).filter((v) => v !== undefined)
  }
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue
    const cleaned = stripUndefined(v)
    if (cleaned !== undefined) out[k] = cleaned
  }
  return out
}

async function saveVersion(versionDoc) {
  const storage = getStorage()
  const cleanDoc = stripUndefined(versionDoc)
  try {
    const db = getFirebaseAdmin().firestore()
    await db.collection(REPORTS_COLLECTION).doc(cleanDoc.id).set(cleanDoc, { merge: true })
  } catch (err) {
    // Production Firestore must not silently lose edits — only fall back for JSON adapter.
    if (String(process.env.STORAGE_ADAPTER || '').toLowerCase() === 'firestore') {
      throw err
    }
    console.warn(
      '[reportProduction] version write fell back to request embed:',
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
    const req = await getRequest(versionDoc.requestId)
    if (!req) throw err
    const versions = Array.isArray(req.opsReportVersions) ? [...req.opsReportVersions] : []
    const idx = versions.findIndex((v) => v.id === versionDoc.id)
    if (idx >= 0) versions[idx] = cleanDoc
    else versions.push(cleanDoc)
    req.opsReportVersions = versions
    req.opsReportId = versionDoc.id
    req.opsReportVersion = versionDoc.version
    await storage.saveAttendanceRequest(req)
  }
  return cleanDoc
}

async function getVersion(reportId) {
  try {
    const db = getFirebaseAdmin().firestore()
    const snap = await db.collection(REPORTS_COLLECTION).doc(reportId).get()
    if (snap.exists) return { id: snap.id, ...snap.data() }
  } catch {
    /* json */
  }
  // Scan requests (json mode)
  const storage = getStorage()
  const all = await storage.getAttendanceRequests()
  for (const req of all) {
    const hit = (req.opsReportVersions || []).find((v) => v.id === reportId)
    if (hit) return hit
  }
  return null
}

/**
 * GENERATE DRAFT from evidence/metadata → REPORT IN PROGRESS.
 * Does not approve. Does not email.
 */
async function generateDraft(requestId, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')

  const stage = deriveManualOpsStage(request)
  const allowed = new Set([
    'evidence_received',
    'evidence_required',
    'attended',
    'report_in_progress',
    'report_ready',
    'assigned',
    'briefing_due',
  ])
  if (!allowed.has(stage) && request.paymentStatus !== 'paid') {
    throw new Error(`Cannot generate report from stage: ${stage}`)
  }

  const draft = buildReportDraft(request)
  assertNoInternalLeakage(draft)

  const existing = await listVersions(requestId)
  const version = nextVersionNumber(existing)
  const now = new Date().toISOString()
  const reportId = `orpt-${crypto.randomBytes(6).toString('hex')}`

  const versionDoc = {
    id: reportId,
    requestId,
    version,
    status: 'draft',
    approvalStatus: 'pending',
    draft,
    createdAt: now,
    createdBy: adminUser.uid || null,
    createdByEmail: adminUser.email || null,
    editedAt: null,
    approvedAt: null,
    approvedBy: null,
    pdfStoragePath: null,
    docxStoragePath: null,
    pdfFileName: null,
    docxFileName: null,
  }
  await saveVersion(versionDoc)

  // Reload so JSON-embedded opsReportVersions from saveVersion are not wiped
  const latest = (await getRequest(requestId)) || request
  latest.opsReportId = reportId
  latest.opsReportVersion = version
  latest.reportStage = 'in_progress'
  latest.reportStatus = 'in_progress'
  latest.reportInProgressAt = now
  latest.opsStage = 'report_in_progress'
  await saveRequest(latest)

  await auditLogService.logEvent({
    type: 'ops_report_draft_generated',
    entityId: requestId,
    reportId,
    version,
    actorId: adminUser.uid || 'admin',
  })

  return { request: latest, report: versionDoc }
}

async function getActiveReport(requestId) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  if (request.opsReportId) {
    const v = await getVersion(request.opsReportId)
    if (v) return { request, report: v }
  }
  const versions = await listVersions(requestId)
  return { request, report: versions[0] || null }
}

/**
 * Apply human edits — preserves humanEdited flags; does not regenerate.
 */
async function editReport(requestId, edits, adminUser = {}) {
  const { request, report } = await getActiveReport(requestId)
  if (!report) throw new Error('No report draft found — generate first')
  if (report.approvalStatus === 'approved') {
    throw new Error('Approved reports are immutable — generate a new version to revise')
  }
  const nextDraft = applySectionEdits(report.draft, edits)
  assertNoInternalLeakage(nextDraft)
  report.draft = nextDraft
  report.editedAt = new Date().toISOString()
  report.editedBy = adminUser.uid || null
  report.status = 'draft'
  await saveVersion(report)
  const latest = (await getRequest(requestId)) || request
  await auditLogService.logEvent({
    type: 'ops_report_edited',
    entityId: requestId,
    reportId: report.id,
    actorId: adminUser.uid || 'admin',
  })
  return { request: latest, report }
}

async function regenerateReportSection(requestId, sectionId, opts = {}, adminUser = {}) {
  const { request, report } = await getActiveReport(requestId)
  if (!report) throw new Error('No report draft found')
  if (report.approvalStatus === 'approved') {
    throw new Error('Cannot regenerate an approved report')
  }
  report.draft = regenerateSection(report.draft, request, sectionId, {
    force: opts.force === true,
  })
  assertNoInternalLeakage(report.draft)
  report.editedAt = new Date().toISOString()
  await saveVersion(report)
  const latest = (await getRequest(requestId)) || request
  await auditLogService.logEvent({
    type: 'ops_report_section_regenerated',
    entityId: requestId,
    reportId: report.id,
    sectionId,
    force: opts.force === true,
    actorId: adminUser.uid || 'admin',
  })
  return { request: latest, report }
}

async function loadEvidenceBytes(request, evidenceId) {
  const items = Array.isArray(request.evidenceItems) ? request.evidenceItems : []
  const item = items.find((e) => e.id === evidenceId)
  if (!item?.storagePath) return null
  try {
    const admin = getFirebaseAdmin()
    const [buf] = await admin.storage().bucket().file(item.storagePath).download()
    return { bytes: buf, mime: item.contentType || null, item }
  } catch {
    return null
  }
}

async function uploadPrivate(buffer, storagePath, contentType) {
  const admin = getFirebaseAdmin()
  const file = admin.storage().bucket().file(storagePath)
  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  })
  return storagePath
}

/**
 * APPROVE FINAL — generates PDF + DOCX, stamps REPORT READY.
 * Does NOT email.
 */
async function approveFinalReport(requestId, adminUser = {}) {
  const { request, report } = await getActiveReport(requestId)
  if (!report) throw new Error('No report draft found')
  if (report.approvalStatus === 'approved') {
    return { request, report, emailSent: false, alreadyApproved: true }
  }

  assertNoInternalLeakage(report.draft)

  // Load images for included evidence refs
  const imageIds = new Set()
  for (const section of report.draft.sections || []) {
    for (const ref of section.imageRefs || []) {
      if (ref.evidenceId) imageIds.add(String(ref.evidenceId))
    }
  }
  const included = new Set(
    (report.draft.evidenceIndex || [])
      .filter((e) => e.included !== false)
      .map((e) => String(e.id))
  )
  const images = []
  for (const id of imageIds) {
    if (included.size && !included.has(id)) continue
    const loaded = await loadEvidenceBytes(request, id)
    if (loaded) images.push({ evidenceId: id, bytes: loaded.bytes, mime: loaded.mime })
  }

  const pdfBuf = await renderClientReportPdf({ draft: report.draft, images })
  const docxBuf = await renderClientReportDocx({ draft: report.draft })

  const now = new Date().toISOString()
  const pdfName = `TB-Report-${request.tenderNumber || requestId}-v${report.version}.pdf`
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
  const docxName = pdfName.replace(/\.pdf$/i, '.docx')
  const pdfPath = `ops-reports/${requestId}/${report.id}/${pdfName}`
  const docxPath = `ops-reports/${requestId}/${report.id}/${docxName}`

  try {
    await uploadPrivate(pdfBuf, pdfPath, 'application/pdf')
    await uploadPrivate(
      docxBuf,
      docxPath,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  } catch (err) {
    // Local/dev without GCS — keep buffers off-request; still mark paths for download via API buffer cache
    report.localPdfBase64 = pdfBuf.toString('base64')
    report.localDocxBase64 = docxBuf.toString('base64')
    console.warn(
      '[reportProduction] GCS upload failed, using local buffer fallback:',
      err instanceof Error ? err.message.slice(0, 120) : 'unknown'
    )
  }

  report.status = 'approved'
  report.approvalStatus = 'approved'
  report.approvedAt = now
  report.approvedBy = adminUser.uid || null
  report.approvedByEmail = adminUser.email || null
  report.pdfStoragePath = pdfPath
  report.docxStoragePath = docxPath
  report.pdfFileName = pdfName
  report.docxFileName = docxName
  report.evidenceSnapshot = {
    at: now,
    evidenceIds: (request.evidenceItems || []).map((e) => e.id),
    count: (request.evidenceItems || []).length,
  }
  await saveVersion(report)

  const latest = (await getRequest(requestId)) || request
  latest.reportStage = 'ready'
  latest.reportStatus = 'ready'
  latest.reportReadyAt = now
  latest.reportReadyBy = adminUser.uid || null
  latest.reportFilePath = pdfPath
  latest.reportFileName = pdfName
  latest.reportDocxPath = docxPath
  latest.reportDocxFileName = docxName
  latest.opsReportId = report.id
  latest.opsReportVersion = report.version
  latest.opsStage = 'report_ready'
  await saveRequest(latest)

  await auditLogService.logEvent({
    type: 'ops_report_approved',
    entityId: requestId,
    reportId: report.id,
    version: report.version,
    actorId: adminUser.uid || 'admin',
    emailSent: false,
  })

  return {
    request: latest,
    report,
    emailSent: false,
    pdfBytes: pdfBuf,
    docxBytes: docxBuf,
  }
}

async function getSignedDownload(requestId, format, adminUser = {}) {
  const { request, report } = await getActiveReport(requestId)
  if (!report) throw new Error('Report not found')
  const isPdf = String(format || 'pdf').toLowerCase() !== 'docx'
  const storagePath = isPdf ? report.pdfStoragePath : report.docxStoragePath
  const fileName = isPdf ? report.pdfFileName : report.docxFileName

  if (report.localPdfBase64 && isPdf) {
    return {
      mode: 'buffer',
      fileName,
      contentType: 'application/pdf',
      buffer: Buffer.from(report.localPdfBase64, 'base64'),
    }
  }
  if (report.localDocxBase64 && !isPdf) {
    return {
      mode: 'buffer',
      fileName,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from(report.localDocxBase64, 'base64'),
    }
  }
  if (!storagePath) throw new Error('Report file not generated yet — approve first')

  const admin = getFirebaseAdmin()
  const [url] = await admin
    .storage()
    .bucket()
    .file(storagePath)
    .getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 })

  await auditLogService.logEvent({
    type: 'ops_report_downloaded',
    entityId: requestId,
    reportId: report.id,
    format: isPdf ? 'pdf' : 'docx',
    actorId: adminUser.uid || 'admin',
  })

  return { mode: 'url', url, fileName, contentType: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
}

module.exports = {
  generateDraft,
  getActiveReport,
  editReport,
  regenerateReportSection,
  approveFinalReport,
  getSignedDownload,
  listVersions,
  getVersion,
  buildReportDraft,
}
