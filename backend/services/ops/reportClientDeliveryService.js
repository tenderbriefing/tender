/**
 * Phase 12 — Controlled client report delivery.
 * Never emails on report_ready / approve / generate.
 * Exact approved PDF/DOCX only. Durable idempotency per delivery attempt.
 */
const crypto = require('crypto')
const { getFirebaseAdmin } = require('../../config/firebaseAdmin')
const { getStorage } = require('../storageAdapter')
const auditLogService = require('../auditLogService')
const opsLifecycle = require('./opsLifecycleService')
const reports = require('./reportProductionService')
const {
  DELIVERY_STATUS_LABELS,
  BLOCKS_DUPLICATE_SEND,
  TERMINAL_SUCCESS,
  isValidEmail,
  normalizeEmailList,
  assertRecipientList,
  defaultSubject,
  defaultBody,
  buildIdempotencyKey,
  stripInternalLeakHints,
} = require('../../domain/clientReportDelivery')

const COLLECTION = 'opsClientDeliveries'

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

async function saveDelivery(doc) {
  const clean = stripUndefined(doc)
  try {
    const db = getFirebaseAdmin().firestore()
    await db.collection(COLLECTION).doc(clean.id).set(clean, { merge: true })
  } catch (err) {
    if (String(process.env.STORAGE_ADAPTER || '').toLowerCase() === 'firestore') throw err
    const req = await opsLifecycle.getRequest(clean.requestId)
    if (!req) throw err
    const list = Array.isArray(req.opsClientDeliveries) ? [...req.opsClientDeliveries] : []
    const idx = list.findIndex((d) => d.id === clean.id)
    if (idx >= 0) list[idx] = clean
    else list.push(clean)
    req.opsClientDeliveries = list
    req.clientDeliveryId = clean.id
    req.clientDeliveryStatus = clean.status
    await getStorage().saveAttendanceRequest(req)
  }
  return clean
}

async function getDelivery(deliveryId) {
  try {
    const db = getFirebaseAdmin().firestore()
    const snap = await db.collection(COLLECTION).doc(deliveryId).get()
    if (snap.exists) return { id: snap.id, ...snap.data() }
  } catch {
    /* json */
  }
  const all = await getStorage().getAttendanceRequests()
  for (const req of all) {
    const hit = (req.opsClientDeliveries || []).find((d) => d.id === deliveryId)
    if (hit) return hit
  }
  return null
}

async function listDeliveries(requestId) {
  try {
    const db = getFirebaseAdmin().firestore()
    const snap = await db
      .collection(COLLECTION)
      .where('requestId', '==', requestId)
      .limit(50)
      .get()
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    return rows
  } catch {
    const req = await opsLifecycle.getRequest(requestId)
    const rows = Array.isArray(req?.opsClientDeliveries) ? [...req.opsClientDeliveries] : []
    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    return rows
  }
}

function publicDeliveryView(delivery) {
  if (!delivery) return null
  return {
    id: delivery.id,
    requestId: delivery.requestId,
    reportVersionId: delivery.reportVersionId,
    reportVersion: delivery.reportVersion,
    status: delivery.status,
    statusLabel: DELIVERY_STATUS_LABELS[delivery.status] || delivery.status,
    to: delivery.to || [],
    cc: delivery.cc || [],
    subject: delivery.subject || '',
    body: delivery.body || '',
    attachPdf: delivery.attachPdf !== false,
    attachDocx: delivery.attachDocx === true,
    attachments: delivery.attachments || [],
    provider: delivery.provider || 'resend',
    providerMessageId: delivery.providerMessageId || null,
    idempotencyKey: delivery.idempotencyKey || null,
    createdAt: delivery.createdAt || null,
    sentAt: delivery.sentAt || null,
    deliveredAt: delivery.deliveredAt || null,
    failedAt: delivery.failedAt || null,
    bouncedAt: delivery.bouncedAt || null,
    failureReason: delivery.failureReason || null,
    resendOfDeliveryId: delivery.resendOfDeliveryId || null,
    confirmedBy: delivery.confirmedBy || null,
    createdBy: delivery.createdBy || null,
  }
}

function assertApprovedReport(report) {
  if (!report) throw new Error('No report found — generate and approve first')
  if (report.approvalStatus !== 'approved') {
    throw new Error('Cannot deliver an unapproved report version')
  }
  if (!report.pdfStoragePath && !report.localPdfBase64) {
    throw new Error('Approved PDF artifact missing — re-approve the report')
  }
}

function buildDefaultDraft(request, report) {
  const company =
    request.smeCompany || request.representedEntity || request.smeName || 'Client'
  const contact = request.contactPerson || company
  const tenderNumber = request.tenderNumber || '—'
  const tenderDescription = request.tenderTitle || ''
  const prefilled = String(request.smeEmail || '').trim().toLowerCase()
  return {
    to: prefilled && isValidEmail(prefilled) ? [prefilled] : [],
    cc: [],
    subject: defaultSubject({ tenderNumber, tenderDescription }),
    body: defaultBody({
      clientName: contact,
      companyName: company,
      tenderNumber,
      tenderDescription,
    }),
    attachPdf: true,
    attachDocx: false,
  }
}

/**
 * Open delivery review — does NOT send.
 * Reuses open delivery_review draft if one exists for the same report version.
 */
async function openDeliveryReview(requestId, adminUser = {}, opts = {}) {
  const request = await opsLifecycle.getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  const stage = opsLifecycle.deriveManualOpsStage(request)
  if (stage !== 'report_ready' && stage !== 'delivered' && !opts.resend) {
    throw new Error(`Cannot open delivery review from stage: ${stage}`)
  }

  const { report } = await reports.getActiveReport(requestId)
  assertApprovedReport(report)

  const existing = await listDeliveries(requestId)
  const open = existing.find(
    (d) =>
      d.reportVersionId === report.id &&
      (d.status === 'delivery_review' || d.status === 'failed' || d.status === 'bounced')
  )
  if (open && !opts.forceNew) {
    return { request, report, delivery: open, created: false }
  }

  // Block accidental new attempt while sending/sent for same version unless explicit resend
  const active = existing.find(
    (d) => d.reportVersionId === report.id && BLOCKS_DUPLICATE_SEND.has(d.status)
  )
  if (active && !opts.resend) {
    throw new Error(
      `Delivery already ${active.status} for this report version — use RESEND REPORT for a new attempt`
    )
  }

  const now = new Date().toISOString()
  const deliveryId = `odel-${crypto.randomBytes(6).toString('hex')}`
  const draft = buildDefaultDraft(request, report)
  const delivery = {
    id: deliveryId,
    requestId,
    reportVersionId: report.id,
    reportVersion: report.version,
    smeId: request.smeId || null,
    companyName: request.smeCompany || null,
    tenderNumber: request.tenderNumber || null,
    tenderDescription: request.tenderTitle || null,
    ...draft,
    attachments: [],
    status: 'delivery_review',
    provider: 'resend',
    providerMessageId: null,
    idempotencyKey: buildIdempotencyKey(requestId, report.id, deliveryId),
    createdBy: adminUser.uid || null,
    createdByEmail: adminUser.email || null,
    confirmedBy: null,
    createdAt: now,
    updatedAt: now,
    sentAt: null,
    deliveredAt: null,
    failedAt: null,
    bouncedAt: null,
    failureReason: null,
    resendOfDeliveryId: opts.resendOfDeliveryId || null,
  }
  await saveDelivery(delivery)

  // Reload so JSON-embedded opsClientDeliveries from saveDelivery are not wiped
  const latest = (await opsLifecycle.getRequest(requestId)) || request
  latest.clientDeliveryId = delivery.id
  latest.clientDeliveryStatus = 'delivery_review'
  latest.clientDeliveryOpenedAt = latest.clientDeliveryOpenedAt || new Date().toISOString()
  await opsLifecycle.saveRequest(latest)

  await auditLogService.logEvent({
    type: 'ops_client_delivery_review_created',
    entityId: requestId,
    deliveryId: delivery.id,
    reportVersionId: report.id,
    actorId: adminUser.uid || 'admin',
    resend: Boolean(opts.resend),
  })

  return { request: latest, report, delivery, created: true }
}

async function updateDeliveryDraft(requestId, deliveryId, patch = {}, adminUser = {}) {
  const delivery = await getDelivery(deliveryId)
  if (!delivery || delivery.requestId !== requestId) throw new Error('Delivery not found')
  if (BLOCKS_DUPLICATE_SEND.has(delivery.status) && delivery.status !== 'sending') {
    if (TERMINAL_SUCCESS.has(delivery.status)) {
      throw new Error('Cannot edit a completed delivery — use RESEND REPORT')
    }
  }
  if (delivery.status === 'sending') {
    throw new Error('Delivery is currently sending — wait or retry after failure')
  }

  const before = {
    to: [...(delivery.to || [])],
    cc: [...(delivery.cc || [])],
    subject: delivery.subject,
    body: delivery.body,
  }

  if (patch.to != null) {
    const to = normalizeEmailList(patch.to)
    assertRecipientList(to)
    delivery.to = to
  }
  if (patch.cc != null) {
    const cc = normalizeEmailList(patch.cc)
    for (const email of cc) {
      if (!isValidEmail(email)) throw new Error(`Invalid CC email: ${email}`)
    }
    delivery.cc = cc
  }
  if (patch.subject != null) {
    delivery.subject = stripInternalLeakHints(String(patch.subject).slice(0, 180))
  }
  if (patch.body != null) {
    delivery.body = stripInternalLeakHints(String(patch.body).slice(0, 20000))
  }
  if (patch.attachPdf != null) delivery.attachPdf = patch.attachPdf !== false
  if (patch.attachDocx != null) delivery.attachDocx = patch.attachDocx === true

  if (delivery.attachPdf === false && delivery.attachDocx !== true) {
    throw new Error('At least one attachment (PDF or DOCX) is required')
  }

  delivery.updatedAt = new Date().toISOString()
  if (delivery.status === 'failed' || delivery.status === 'bounced') {
    delivery.status = 'delivery_review'
    delivery.failureReason = null
  }
  await saveDelivery(delivery)

  const changes = []
  if (JSON.stringify(before.to) !== JSON.stringify(delivery.to)) changes.push('recipient')
  if (JSON.stringify(before.cc) !== JSON.stringify(delivery.cc)) changes.push('cc')
  if (before.subject !== delivery.subject) changes.push('subject')
  if (before.body !== delivery.body) changes.push('body')
  if (changes.length) {
    await auditLogService.logEvent({
      type: 'ops_client_delivery_draft_edited',
      entityId: requestId,
      deliveryId,
      changes,
      actorId: adminUser.uid || 'admin',
      to: delivery.to,
      cc: delivery.cc,
    })
  }

  const request = await opsLifecycle.getRequest(requestId)
  return { request, delivery }
}

async function loadApprovedArtifactBytes(request, report, format) {
  const isPdf = format === 'pdf'
  if (isPdf && report.localPdfBase64) {
    return {
      buffer: Buffer.from(report.localPdfBase64, 'base64'),
      fileName: report.pdfFileName || `report-${request.id}.pdf`,
      storagePath: report.pdfStoragePath || null,
      contentType: 'application/pdf',
    }
  }
  if (!isPdf && report.localDocxBase64) {
    return {
      buffer: Buffer.from(report.localDocxBase64, 'base64'),
      fileName: report.docxFileName || `report-${request.id}.docx`,
      storagePath: report.docxStoragePath || null,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }
  const storagePath = isPdf ? report.pdfStoragePath : report.docxStoragePath
  const fileName = isPdf
    ? report.pdfFileName || `report-${request.id}.pdf`
    : report.docxFileName || `report-${request.id}.docx`
  if (!storagePath) throw new Error(`${format.toUpperCase()} artifact missing on approved report`)

  const admin = getFirebaseAdmin()
  const [buf] = await admin.storage().bucket().file(storagePath).download()
  return {
    buffer: buf,
    fileName,
    storagePath,
    contentType: isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

/**
 * CONFIRM & SEND — requires confirm === true.
 * Idempotent on delivery.idempotencyKey.
 */
async function confirmAndSend(requestId, deliveryId, opts = {}, adminUser = {}) {
  if (opts.confirm !== true) {
    throw new Error('Explicit confirm=true is required — CONFIRM & SEND gate')
  }

  const delivery = await getDelivery(deliveryId)
  if (!delivery || delivery.requestId !== requestId) throw new Error('Delivery not found')

  if (TERMINAL_SUCCESS.has(delivery.status)) {
    return {
      request: await opsLifecycle.getRequest(requestId),
      delivery,
      emailSent: false,
      duplicate: true,
      alreadySent: true,
    }
  }
  if (delivery.status === 'sending') {
    return {
      request: await opsLifecycle.getRequest(requestId),
      delivery,
      emailSent: false,
      duplicate: true,
      inFlight: true,
    }
  }

  const request = await opsLifecycle.getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  const stage = opsLifecycle.deriveManualOpsStage(request)
  if (stage !== 'report_ready' && stage !== 'delivered') {
    throw new Error(`Cannot send from stage: ${stage}`)
  }

  const { report } = await reports.getActiveReport(requestId)
  assertApprovedReport(report)
  if (report.id !== delivery.reportVersionId) {
    throw new Error('Delivery is locked to a different report version — open a new delivery review')
  }

  assertRecipientList(delivery.to || [])
  stripInternalLeakHints(delivery.subject)
  stripInternalLeakHints(delivery.body)
  if (delivery.attachPdf === false && delivery.attachDocx !== true) {
    throw new Error('At least one attachment is required')
  }

  delivery.status = 'sending'
  delivery.confirmedBy = adminUser.uid || null
  delivery.confirmedByEmail = adminUser.email || null
  delivery.updatedAt = new Date().toISOString()
  await saveDelivery(delivery)
  let latestReq = (await opsLifecycle.getRequest(requestId)) || request
  latestReq.clientDeliveryStatus = 'sending'
  latestReq.clientDeliveryId = delivery.id
  await opsLifecycle.saveRequest(latestReq)

  await auditLogService.logEvent({
    type: 'ops_client_delivery_send_confirmed',
    entityId: requestId,
    deliveryId,
    reportVersionId: delivery.reportVersionId,
    to: delivery.to,
    cc: delivery.cc,
    actorId: adminUser.uid || 'admin',
  })

  // Load exact approved artifacts — never regenerate
  const attachmentsMeta = []
  const resendAttachments = []
  try {
    if (delivery.attachPdf !== false) {
      const pdf = await loadApprovedArtifactBytes(request, report, 'pdf')
      const hash = sha256(pdf.buffer)
      attachmentsMeta.push({
        format: 'pdf',
        fileName: pdf.fileName,
        storagePath: pdf.storagePath,
        sha256: hash,
        sizeBytes: pdf.buffer.length,
      })
      resendAttachments.push({ filename: pdf.fileName, content: pdf.buffer })
    }
    if (delivery.attachDocx === true) {
      const docx = await loadApprovedArtifactBytes(request, report, 'docx')
      const hash = sha256(docx.buffer)
      attachmentsMeta.push({
        format: 'docx',
        fileName: docx.fileName,
        storagePath: docx.storagePath,
        sha256: hash,
        sizeBytes: docx.buffer.length,
      })
      resendAttachments.push({ filename: docx.fileName, content: docx.buffer })
    }
  } catch (err) {
    delivery.status = 'failed'
    delivery.failedAt = new Date().toISOString()
    delivery.failureReason = err instanceof Error ? err.message.slice(0, 240) : 'Artifact load failed'
    await saveDelivery(delivery)
    const failedReq = (await opsLifecycle.getRequest(requestId)) || request
    failedReq.clientDeliveryStatus = 'failed'
    await opsLifecycle.saveRequest(failedReq)
    throw err
  }

  delivery.attachments = attachmentsMeta
  await saveDelivery(delivery)

  const txEmail = require('../transactionalEmailService')
  const sendResult = await txEmail.sendClientReportDeliveryEmail(
    {
      to: delivery.to[0],
      cc: delivery.cc || [],
      subject: delivery.subject,
      body: delivery.body,
      requestId,
      reportVersionId: delivery.reportVersionId,
      tenderNumber: request.tenderNumber,
      tenderTitle: request.tenderTitle,
      companyName: request.smeCompany,
    },
    {
      idempotencyKey: delivery.idempotencyKey,
      attachments: resendAttachments,
      resendClient: opts.resendClient || null,
      env: opts.env || process.env,
      deps: opts.deps || {},
    }
  )

  if (sendResult.duplicate) {
    delivery.status = delivery.status === 'sending' ? 'sent' : delivery.status
    if (!delivery.sentAt) delivery.sentAt = new Date().toISOString()
    delivery.providerMessageId = delivery.providerMessageId || sendResult.id || null
    await saveDelivery(delivery)
    return {
      request: await opsLifecycle.getRequest(requestId),
      delivery,
      emailSent: false,
      duplicate: true,
    }
  }

  if (!sendResult.sent) {
    delivery.status = 'failed'
    delivery.failedAt = new Date().toISOString()
    delivery.failureReason = String(sendResult.error || 'Send failed').slice(0, 240)
    await saveDelivery(delivery)
    const latest = await opsLifecycle.getRequest(requestId)
    latest.clientDeliveryStatus = 'failed'
    await opsLifecycle.saveRequest(latest)
    await auditLogService.logEvent({
      type: 'ops_client_delivery_failed',
      entityId: requestId,
      deliveryId,
      failureReason: delivery.failureReason,
      actorId: adminUser.uid || 'admin',
    })
    return {
      request: latest,
      delivery,
      emailSent: false,
      error: delivery.failureReason,
    }
  }

  const now = new Date().toISOString()
  delivery.status = 'sent'
  delivery.sentAt = now
  delivery.providerMessageId = sendResult.id || null
  delivery.provider = 'resend'
  delivery.failureReason = null
  await saveDelivery(delivery)

  // Operational delivered = provider accepted send (inbox delivery tracked separately)
  const latest = (await opsLifecycle.getRequest(requestId)) || request
  latest.clientDeliveryStatus = 'sent'
  latest.clientDeliveryId = delivery.id
  latest.deliveredAt = now
  latest.reportDeliveredAt = now
  latest.deliveredBy = adminUser.uid || null
  latest.deliveredByEmail = adminUser.email || null
  latest.deliveryClientEmail = (delivery.to || [])[0] || null
  latest.deliveryNote = `Client report v${delivery.reportVersion} emailed via Resend`
  latest.opsStage = 'delivered'
  await opsLifecycle.saveRequest(latest)

  await auditLogService.logEvent({
    type: 'ops_client_delivery_provider_accepted',
    entityId: requestId,
    deliveryId,
    reportVersionId: delivery.reportVersionId,
    providerMessageId: delivery.providerMessageId,
    to: delivery.to,
    attachments: attachmentsMeta.map((a) => ({
      format: a.format,
      fileName: a.fileName,
      sha256: a.sha256,
    })),
    actorId: adminUser.uid || 'admin',
    emailSent: true,
  })

  return {
    request: latest,
    delivery,
    emailSent: true,
    providerMessageId: delivery.providerMessageId,
  }
}

/** Controlled retry of a failed delivery (same deliveryId / idempotency key if never accepted). */
async function retryDelivery(requestId, deliveryId, opts = {}, adminUser = {}) {
  const delivery = await getDelivery(deliveryId)
  if (!delivery || delivery.requestId !== requestId) throw new Error('Delivery not found')
  if (delivery.status !== 'failed' && delivery.status !== 'bounced') {
    throw new Error('Only failed or bounced deliveries can be retried')
  }
  // New attempt identity for bounce (recipient may change) — mint new idempotency if bounced
  if (delivery.status === 'bounced' || opts.newAttempt === true) {
    const opened = await openDeliveryReview(requestId, adminUser, {
      forceNew: true,
      resend: true,
      resendOfDeliveryId: delivery.id,
    })
    // Prefer updating the newly opened draft with prior content
    await updateDeliveryDraft(
      requestId,
      opened.delivery.id,
      {
        to: delivery.to,
        cc: delivery.cc,
        subject: delivery.subject,
        body: delivery.body,
        attachPdf: delivery.attachPdf,
        attachDocx: delivery.attachDocx,
      },
      adminUser
    )
    return confirmAndSend(
      requestId,
      opened.delivery.id,
      { confirm: true, resendClient: opts.resendClient, env: opts.env, deps: opts.deps },
      adminUser
    )
  }
  delivery.status = 'delivery_review'
  delivery.failureReason = null
  await saveDelivery(delivery)
  return confirmAndSend(
    requestId,
    deliveryId,
    { confirm: true, resendClient: opts.resendClient, env: opts.env, deps: opts.deps },
    adminUser
  )
}

/** Explicit RESEND after successful delivery — new auditable attempt. */
async function resendReport(requestId, adminUser = {}, opts = {}) {
  const existing = await listDeliveries(requestId)
  const prior = existing.find((d) => TERMINAL_SUCCESS.has(d.status))
  const opened = await openDeliveryReview(requestId, adminUser, {
    forceNew: true,
    resend: true,
    resendOfDeliveryId: prior?.id || null,
  })
  await auditLogService.logEvent({
    type: 'ops_client_delivery_resend_opened',
    entityId: requestId,
    deliveryId: opened.delivery.id,
    resendOfDeliveryId: prior?.id || null,
    actorId: adminUser.uid || 'admin',
  })
  return opened
}

const PROVIDER_RANK = {
  sending: 5,
  sent: 20,
  delivered: 40,
  failed: 50,
  bounced: 50,
}

function canApplyProviderStatus(fromStatus, toStatus) {
  if (!toStatus) return false
  if (fromStatus === toStatus) return false
  // Terminal bounce/failed: only allow same or stay
  if (fromStatus === 'bounced' || fromStatus === 'failed') {
    return false
  }
  return (PROVIDER_RANK[toStatus] || 0) > (PROVIDER_RANK[fromStatus] || 0)
}

async function findDeliveryByProviderMessageId(providerMessageId) {
  const id = String(providerMessageId || '').trim()
  if (!id) return null
  try {
    const db = getFirebaseAdmin().firestore()
    const snap = await db
      .collection(COLLECTION)
      .where('providerMessageId', '==', id)
      .limit(5)
      .get()
    if (!snap.empty) {
      const d = snap.docs[0]
      return { id: d.id, ...d.data() }
    }
  } catch {
    /* json */
  }
  const all = await getStorage().getAttendanceRequests()
  for (const req of all) {
    const hit = (req.opsClientDeliveries || []).find(
      (d) => String(d.providerMessageId || '') === id
    )
    if (hit) return hit
  }
  return null
}

/**
 * Apply Resend lifecycle event onto ops client delivery (idempotent / ordered).
 * Does NOT change locked report version.
 */
async function applyProviderEventByMessageId(providerMessageId, event = {}) {
  const delivery = await findDeliveryByProviderMessageId(providerMessageId)
  if (!delivery) {
    return { applied: false, reason: 'delivery_not_found' }
  }

  const mapped = String(event.status || '').toLowerCase()
  const nextStatus =
    mapped === 'delivered'
      ? 'delivered'
      : mapped === 'bounced' || mapped === 'complained'
        ? 'bounced'
        : mapped === 'failed'
          ? 'failed'
          : mapped === 'sent' || mapped === 'accepted'
            ? 'sent'
            : null

  if (!nextStatus) {
    return { applied: false, reason: 'unsupported_status', deliveryId: delivery.id }
  }
  if (!canApplyProviderStatus(delivery.status, nextStatus)) {
    return {
      applied: false,
      reason: 'out_of_order_or_duplicate',
      deliveryId: delivery.id,
      status: delivery.status,
    }
  }

  const at = event.at || new Date().toISOString()
  delivery.providerStatus = nextStatus
  delivery.providerStatusUpdatedAt = at
  if (nextStatus === 'delivered') {
    delivery.status = 'delivered'
    delivery.deliveredAt = at
  } else if (nextStatus === 'bounced') {
    delivery.status = 'bounced'
    delivery.bouncedAt = at
    delivery.failureReason = String(event.reason || 'bounced').slice(0, 240)
  } else if (nextStatus === 'failed') {
    delivery.status = 'failed'
    delivery.failedAt = at
    delivery.failureReason = String(event.reason || 'failed').slice(0, 240)
  } else if (nextStatus === 'sent' && delivery.status !== 'delivered') {
    delivery.status = 'sent'
    delivery.sentAt = delivery.sentAt || at
  }
  await saveDelivery(delivery)

  const request = await opsLifecycle.getRequest(delivery.requestId)
  if (request) {
    request.clientDeliveryStatus = delivery.status
    request.clientDeliveryProviderStatus = nextStatus
    request.clientDeliveryUpdatedAt = at
    await opsLifecycle.saveRequest(request)
  }

  await auditLogService.logEvent({
    type: `ops_client_delivery_provider_${nextStatus}`,
    entityId: delivery.requestId,
    deliveryId: delivery.id,
    providerMessageId,
    reportVersionId: delivery.reportVersionId,
  })

  return {
    applied: true,
    deliveryId: delivery.id,
    status: delivery.status,
    reportVersionId: delivery.reportVersionId,
  }
}

async function recordProviderDelivered(deliveryId, meta = {}) {
  const delivery = await getDelivery(deliveryId)
  if (!delivery) throw new Error('Delivery not found')
  if (delivery.providerMessageId) {
    return applyProviderEventByMessageId(delivery.providerMessageId, {
      status: 'delivered',
      at: meta.at,
    })
  }
  if (delivery.status === 'bounced' || delivery.status === 'failed') return delivery
  delivery.status = 'delivered'
  delivery.deliveredAt = meta.at || new Date().toISOString()
  await saveDelivery(delivery)
  const request = await opsLifecycle.getRequest(delivery.requestId)
  if (request) {
    request.clientDeliveryStatus = 'delivered'
    await opsLifecycle.saveRequest(request)
  }
  await auditLogService.logEvent({
    type: 'ops_client_delivery_provider_delivered',
    entityId: delivery.requestId,
    deliveryId,
    providerMessageId: delivery.providerMessageId,
  })
  return delivery
}

async function recordProviderBounce(deliveryId, meta = {}) {
  const delivery = await getDelivery(deliveryId)
  if (!delivery) throw new Error('Delivery not found')
  if (delivery.providerMessageId) {
    return applyProviderEventByMessageId(delivery.providerMessageId, {
      status: 'bounced',
      at: meta.at,
      reason: meta.reason,
    })
  }
  delivery.status = 'bounced'
  delivery.bouncedAt = meta.at || new Date().toISOString()
  delivery.failureReason = String(meta.reason || 'bounced').slice(0, 240)
  await saveDelivery(delivery)
  const request = await opsLifecycle.getRequest(delivery.requestId)
  if (request) {
    request.clientDeliveryStatus = 'bounced'
    await opsLifecycle.saveRequest(request)
  }
  await auditLogService.logEvent({
    type: 'ops_client_delivery_bounced',
    entityId: delivery.requestId,
    deliveryId,
    failureReason: delivery.failureReason,
  })
  return delivery
}

module.exports = {
  openDeliveryReview,
  updateDeliveryDraft,
  confirmAndSend,
  retryDelivery,
  resendReport,
  listDeliveries,
  getDelivery,
  publicDeliveryView,
  recordProviderDelivered,
  recordProviderBounce,
  findDeliveryByProviderMessageId,
  applyProviderEventByMessageId,
  buildDefaultDraft,
  assertApprovedReport,
}
