/**
 * Phase 3H — briefing lifecycle notifications.
 * Reuses Resend + notifications idempotency ledger (same pattern as founderOps).
 * Fail-soft: business flows must not fail when notify fails.
 * Audience-correct: Founder ops vs SME TX vs YA TX — never leak raw AI errors to SME.
 */
const { Resend } = require('resend')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const DEFAULT_FROM = 'TenderBriefing <hello@tenderbriefing.co.za>'
const DEFAULT_FOUNDER = 'info@tenderbriefing.co.za'
const SITE_URL_DEFAULT = 'https://www.tenderbriefing.co.za'
const IDEMPOTENCY_COLLECTION = 'notifications'
const LOG_PREFIX = '[briefingLifecycleNotify]'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sliceStr(value, max = 200) {
  return String(value || '')
    .trim()
    .slice(0, max)
}

function baseUrl(env = process.env) {
  return (env.NEXT_PUBLIC_SITE_URL || env.SITE_URL || SITE_URL_DEFAULT).replace(/\/$/, '')
}

function founderRecipients(env = process.env) {
  const raw = env.FOUNDER_EMAIL_ALLOWLIST || env.NEXT_PUBLIC_FOUNDER_EMAIL_ALLOWLIST || DEFAULT_FOUNDER
  return String(raw)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

function fromAddress(env = process.env) {
  return (env.RESEND_FROM_EMAIL || '').trim() || DEFAULT_FROM
}

function idempotencyDocId(key) {
  const safe = String(key)
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .slice(0, 140)
  return `briefing-life-idem-${safe}`
}

const IdempotencyKeys = {
  evidenceSubmitted: (reportId) => `bi-evidence:${reportId}`,
  transcriptionComplete: (reportId) => `bi-transcription:${reportId}`,
  draftReady: (reportId, version) => `bi-draft-ready:${reportId}:${version || 'v'}`,
  aiFailed: (reportId, attempt) => `bi-ai-failed:${reportId}:${attempt || 1}`,
  reportApproved: (reportId) => `bi-report-approved:${reportId}`,
  clarificationRequested: (updateId) => `bfu-requested:${updateId}`,
  clarificationResponse: (updateId) => `bfu-response:${updateId}`,
  clarificationResolved: (updateId) => `bfu-resolved:${updateId}`,
  assignmentChanged: (requestId, agentId) => `ya-assign-changed:${requestId}:${agentId}`,
  evidenceCorrection: (reportId) => `bi-evidence-correction:${reportId}`,
  upcomingBriefing: (requestId) => `briefing-upcoming:${requestId}`,
}

function buildOpsSummary({
  eventType,
  headline,
  subject,
  entityId,
  requestId,
  reportId,
  tenderTitle,
  tenderNumber,
  detail,
  adminPath = '/founder/briefings',
  idempotencyKey,
  smeSafeDetail,
}) {
  return {
    kind: 'ops_event',
    eventType: sliceStr(eventType, 80),
    headline: sliceStr(headline, 120),
    subject: sliceStr(subject, 180),
    entityId: sliceStr(entityId, 128),
    requestId: sliceStr(requestId, 128),
    reportId: sliceStr(reportId, 128),
    tenderTitle: sliceStr(tenderTitle || 'Briefing', 200),
    tenderNumber: sliceStr(tenderNumber, 80),
    detail: sliceStr(detail, 500),
    smeSafeDetail: sliceStr(smeSafeDetail || detail, 500),
    adminUrl: `${baseUrl()}${adminPath}`,
    timestamp: new Date().toISOString(),
    idempotencyKey,
  }
}

function buildOpsEmailTemplate(summary) {
  const subject = summary.subject || `[Ops] ${summary.headline}`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
      <div style="background:#0F1E3D;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:18px;">${escapeHtml(summary.headline)}</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;color:#334155;">
        <p style="margin:0 0 10px;"><strong>Event:</strong> ${escapeHtml(summary.eventType)}</p>
        <p style="margin:0 0 10px;"><strong>Tender:</strong> ${escapeHtml(summary.tenderTitle)}</p>
        ${
          summary.tenderNumber
            ? `<p style="margin:0 0 10px;"><strong>Ref:</strong> ${escapeHtml(summary.tenderNumber)}</p>`
            : ''
        }
        ${
          summary.requestId
            ? `<p style="margin:0 0 10px;"><strong>Request:</strong> ${escapeHtml(summary.requestId)}</p>`
            : ''
        }
        ${
          summary.reportId
            ? `<p style="margin:0 0 10px;"><strong>Report:</strong> ${escapeHtml(summary.reportId)}</p>`
            : ''
        }
        <p style="margin:0 0 10px;"><strong>Detail:</strong> ${escapeHtml(summary.detail || '—')}</p>
        <p style="margin:0 0 10px;"><strong>When:</strong> ${escapeHtml(summary.timestamp)}</p>
        <p style="margin:16px 0 10px;">
          <a href="${escapeHtml(summary.adminUrl)}" style="display:inline-block;background:#0F1E3D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
            Open Founder ops
          </a>
        </p>
      </div>
    </div>
  `.trim()
  const text = [
    summary.headline,
    `Event: ${summary.eventType}`,
    `Tender: ${summary.tenderTitle}`,
    summary.tenderNumber ? `Ref: ${summary.tenderNumber}` : null,
    summary.requestId ? `Request: ${summary.requestId}` : null,
    summary.reportId ? `Report: ${summary.reportId}` : null,
    `Detail: ${summary.detail || '—'}`,
    `Ops: ${summary.adminUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

async function claimIdempotency(db, idempotencyKey, channel) {
  const ref = db.collection(IDEMPOTENCY_COLLECTION).doc(idempotencyDocId(idempotencyKey))
  const existing = await ref.get()
  if (existing.exists) {
    const status = existing.data()?.status
    if (status === 'sent' || status === 'claimed') {
      return { claimed: false, duplicate: true, ref }
    }
  }
  const payload = sanitizeFirestoreData({
    type: 'idempotency_marker',
    channel,
    idempotencyKey,
    status: 'claimed',
    createdAt: existing.exists ? existing.data()?.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  if (!existing.exists && typeof ref.create === 'function') {
    try {
      await ref.create(payload)
      return { claimed: true, duplicate: false, ref }
    } catch {
      return { claimed: false, duplicate: true, ref }
    }
  }
  await ref.set(payload, { merge: true })
  return { claimed: true, duplicate: false, ref }
}

async function markIdempotency(ref, status, extra = {}) {
  if (!ref) return
  await ref.set(
    sanitizeFirestoreData({
      status,
      updatedAt: new Date().toISOString(),
      ...extra,
    }),
    { merge: true }
  )
}

async function sendFounderResend(summary, deps = {}) {
  const env = deps.env || process.env
  const recipients = founderRecipients(env)
  if (!recipients.length) return { sent: false, skipped: true, error: 'No founder recipients' }
  const apiKey = (env.RESEND_API_KEY || '').trim()
  if (!apiKey && !deps.resendClient) return { sent: false, skipped: true, error: 'RESEND_API_KEY missing' }
  const client = deps.resendClient || new Resend(apiKey)
  const tpl = buildOpsEmailTemplate(summary)
  const result = await client.emails.send({
    from: fromAddress(env),
    to: recipients,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  })
  if (result?.error) return { sent: false, skipped: false, error: String(result.error?.message || result.error).slice(0, 200) }
  return { sent: true, skipped: false, id: result?.data?.id || null }
}

async function notifyFounderOps(summary, deps = {}) {
  const result = { notified: false, duplicate: false, email: null, error: null }
  try {
    if (!summary?.idempotencyKey) {
      result.error = 'missing_idempotency_key'
      return result
    }
    const getDb = deps.getFirestore || (() => require('../config/firebaseAdmin').getFirestore())
    let claim = { claimed: true, duplicate: false, ref: null }
    try {
      claim = await claimIdempotency(getDb(), summary.idempotencyKey, 'briefing_lifecycle_founder')
      if (claim.duplicate) {
        result.duplicate = true
        return result
      }
    } catch (err) {
      console.error(
        `${LOG_PREFIX} idempotency claim failed:`,
        err instanceof Error ? err.message.slice(0, 160) : 'unknown'
      )
    }
    const email = await sendFounderResend(summary, deps)
    result.email = email
    result.notified = Boolean(email.sent)
    if (claim.ref) {
      await markIdempotency(claim.ref, email.sent ? 'sent' : email.skipped ? 'skipped' : 'failed', {
        error: email.error || null,
        providerMessageId: email.id || null,
      })
    }
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message.slice(0, 200) : 'notify failed'
    return result
  }
}

async function notifyFounderOpsSafe(summary, deps = {}) {
  try {
    return await notifyFounderOps(summary, deps)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notify failed'
    console.error(`${LOG_PREFIX} Safe founder ops caught:`, message.slice(0, 200))
    return { notified: false, duplicate: false, email: null, error: message.slice(0, 200) }
  }
}

/** 1 — upcoming compulsory briefing (Founder ops) */
async function notifyUpcomingBriefingSafe(request = {}, deps = {}) {
  const requestId = request.id || request.requestId
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'upcoming_briefing',
      headline: 'Upcoming compulsory briefing',
      subject: `[Upcoming] ${request.tenderTitle || 'Briefing'}`,
      entityId: requestId,
      requestId,
      tenderTitle: request.tenderTitle,
      tenderNumber: request.tenderNumber,
      detail: `Briefing ${request.briefingDate || ''} ${request.briefingTime || ''} @ ${request.briefingVenue || 'venue TBD'}`,
      adminPath: `/founder/briefings/${requestId || ''}`,
      idempotencyKey: IdempotencyKeys.upcomingBriefing(requestId),
    }),
    deps
  )
}

/** 4 — YA evidence submitted → Founder */
async function notifyEvidenceSubmittedSafe(ctx = {}, deps = {}) {
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'evidence_submitted',
      headline: 'Youth Agent evidence submitted',
      subject: `[Evidence] ${ctx.tenderTitle || ctx.reportId || 'Briefing'}`,
      entityId: ctx.reportId,
      requestId: ctx.requestId,
      reportId: ctx.reportId,
      tenderTitle: ctx.tenderTitle,
      tenderNumber: ctx.tenderNumber,
      detail: 'Audio and attendance proof uploaded. Transcription/AI pipeline may follow.',
      adminPath: `/founder/briefings/${ctx.requestId || ''}`,
      idempotencyKey: IdempotencyKeys.evidenceSubmitted(ctx.reportId),
    }),
    deps
  )
}

/** 5 — transcription completed → Founder (low-noise; optional) */
async function notifyTranscriptionCompletedSafe(ctx = {}, deps = {}) {
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'transcription_completed',
      headline: 'Briefing transcription completed',
      subject: `[Transcript] ${ctx.tenderTitle || ctx.reportId || 'Briefing'}`,
      entityId: ctx.reportId,
      requestId: ctx.requestId,
      reportId: ctx.reportId,
      tenderTitle: ctx.tenderTitle,
      tenderNumber: ctx.tenderNumber,
      detail: 'Transcript ready. AI draft generation may follow.',
      idempotencyKey: IdempotencyKeys.transcriptionComplete(ctx.reportId),
    }),
    deps
  )
}

/** 6 — AI draft ready for Founder review */
async function notifyDraftReadySafe(ctx = {}, deps = {}) {
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'ai_draft_ready',
      headline: 'AI briefing draft ready for Founder review',
      subject: `[Draft ready] ${ctx.tenderTitle || ctx.reportId || 'Briefing'}`,
      entityId: ctx.reportId,
      requestId: ctx.requestId,
      reportId: ctx.reportId,
      tenderTitle: ctx.tenderTitle,
      tenderNumber: ctx.tenderNumber,
      detail: sliceStr(ctx.detail || `Version ${ctx.version || ''} awaiting Founder approval.`, 400),
      adminPath: `/founder/briefings/${ctx.requestId || ''}`,
      idempotencyKey: IdempotencyKeys.draftReady(ctx.reportId, ctx.version),
    }),
    deps
  )
}

/** 7 — AI/report failure (Founder only — no raw stack to SME) */
async function notifyAiFailureSafe(ctx = {}, deps = {}) {
  const safeDetail = sliceStr(
    ctx.smeSafeDetail ||
      'Briefing report generation needs operational retry. Evidence and Youth Agent eligibility are preserved.',
    400
  )
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'ai_report_failed',
      headline: 'Briefing report generation needs attention',
      subject: `[AI retry] ${ctx.tenderTitle || ctx.reportId || 'Briefing'}`,
      entityId: ctx.reportId,
      requestId: ctx.requestId,
      reportId: ctx.reportId,
      tenderTitle: ctx.tenderTitle,
      tenderNumber: ctx.tenderNumber,
      detail: sliceStr(ctx.detail || safeDetail, 400),
      smeSafeDetail: safeDetail,
      idempotencyKey: IdempotencyKeys.aiFailed(ctx.reportId, ctx.attempt),
    }),
    deps
  )
}

/** 8 — Founder approved report */
async function notifyReportApprovedSafe(ctx = {}, deps = {}) {
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'report_approved',
      headline: 'Founder approved briefing report',
      subject: `[Approved] ${ctx.tenderTitle || ctx.reportId || 'Briefing'}`,
      entityId: ctx.reportId,
      requestId: ctx.requestId,
      reportId: ctx.reportId,
      tenderTitle: ctx.tenderTitle,
      tenderNumber: ctx.tenderNumber,
      detail: 'Report approved. Delivery to SME may follow.',
      idempotencyKey: IdempotencyKeys.reportApproved(ctx.reportId),
    }),
    deps
  )
}

/** 10 — clarification requested (Founder ops) */
async function notifyClarificationRequestedSafe(update = {}, deps = {}) {
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'clarification_requested',
      headline: 'Briefing clarification requested',
      subject: `[Clarification] ${update.title || update.id}`,
      entityId: update.id,
      requestId: update.briefingRequestId,
      tenderTitle: update.title,
      detail: sliceStr(update.content, 300),
      idempotencyKey: IdempotencyKeys.clarificationRequested(update.id),
    }),
    deps
  )
}

/** 11 — clarification response added (Founder ops) */
async function notifyClarificationResponseSafe(update = {}, deps = {}) {
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'clarification_response_added',
      headline: 'Clarification response added',
      subject: `[Clarification update] ${update.title || update.id}`,
      entityId: update.id,
      requestId: update.briefingRequestId,
      tenderTitle: update.title,
      detail: sliceStr(update.content, 300),
      idempotencyKey: IdempotencyKeys.clarificationResponse(update.id),
    }),
    deps
  )
}

/** 13 — assignment changed (Founder ops; YA TX handled separately) */
async function notifyAssignmentChangedSafe(ctx = {}, deps = {}) {
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'assignment_changed',
      headline: 'Youth Agent assignment changed',
      subject: `[Reassign] ${ctx.tenderTitle || ctx.requestId}`,
      entityId: ctx.requestId,
      requestId: ctx.requestId,
      tenderTitle: ctx.tenderTitle,
      tenderNumber: ctx.tenderNumber,
      detail: `From ${ctx.previousAgentId || 'unassigned'} → ${ctx.agentId || 'new agent'}`,
      idempotencyKey: IdempotencyKeys.assignmentChanged(ctx.requestId, ctx.agentId),
    }),
    deps
  )
}

/** 14 — evidence correction required (Founder ops) */
async function notifyEvidenceCorrectionSafe(ctx = {}, deps = {}) {
  return notifyFounderOpsSafe(
    buildOpsSummary({
      eventType: 'evidence_correction_required',
      headline: 'Evidence requires correction',
      subject: `[Evidence] Correction required — ${ctx.tenderTitle || ctx.reportId}`,
      entityId: ctx.reportId,
      requestId: ctx.requestId,
      reportId: ctx.reportId,
      tenderTitle: ctx.tenderTitle,
      detail: sliceStr(ctx.detail || 'Youth Agent must re-upload evidence.', 300),
      idempotencyKey: IdempotencyKeys.evidenceCorrection(ctx.reportId),
    }),
    deps
  )
}

module.exports = {
  IdempotencyKeys,
  buildOpsSummary,
  buildOpsEmailTemplate,
  notifyFounderOps,
  notifyFounderOpsSafe,
  notifyUpcomingBriefingSafe,
  notifyEvidenceSubmittedSafe,
  notifyTranscriptionCompletedSafe,
  notifyDraftReadySafe,
  notifyAiFailureSafe,
  notifyReportApprovedSafe,
  notifyClarificationRequestedSafe,
  notifyClarificationResponseSafe,
  notifyAssignmentChangedSafe,
  notifyEvidenceCorrectionSafe,
}
