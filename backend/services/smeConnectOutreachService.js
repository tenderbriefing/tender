/**
 * Phase 20 — Controlled SME Connect outreach via existing Resend transactional email.
 * Only HUMAN_APPROVED / READY_FOR_OUTREACH candidates may be sent.
 * Certification overrideRecipient forces a TenderBriefing test inbox.
 */
const { SME_CONNECT_STATUS } = require('../domain/ocdsDayReconciliation')
const store = require('./smeConnectRecommendationStore')
const auditLogService = require('./auditLogService')
const {
  sendViaResend,
  IdempotencyKeys,
  absoluteUrl,
} = require('../../lib/services/transactionalEmailService')

function appBaseUrl(env = process.env) {
  return (
    String(env.NEXT_PUBLIC_APP_URL || env.APP_URL || 'https://www.tenderbriefing.co.za')
      .trim()
      .replace(/\/$/, '') || 'https://www.tenderbriefing.co.za'
  )
}

function buildCtaUrl(candidateId, env = process.env) {
  // Dynamic import of TS helper via require of compiled path — use JS crypto mirror
  const { createSmeConnectCtaToken } = requireCtaToken()
  const { token } = createSmeConnectCtaToken(candidateId)
  return `${appBaseUrl(env)}/sme-connect/attend?token=${encodeURIComponent(token)}`
}

function requireCtaToken() {
  try {
    // Prefer TS module via Next/tsx path; fall back to local JS shim
    return require('../../lib/security/smeConnectCtaToken')
  } catch {
    const crypto = require('crypto')
    function resolveSecret() {
      return (
        process.env.SME_CONNECT_CTA_SECRET ||
        process.env.SYNC_SECRET ||
        process.env.PRIVATE_TENDER_INVITE_SECRET ||
        'tb-sme-connect-cta-dev'
      )
    }
    function signRaw(raw) {
      return crypto.createHmac('sha256', resolveSecret()).update(raw).digest('hex').slice(0, 24)
    }
    return {
      createSmeConnectCtaToken(candidateId, ttlMs = 14 * 24 * 60 * 60 * 1000) {
        const id = String(candidateId || '').trim()
        if (!id) throw new Error('candidateId required')
        const exp = Date.now() + Math.max(60_000, ttlMs)
        const raw = `${id}:${exp}`
        const sig = signRaw(raw)
        const token = Buffer.from(`${raw}:${sig}`).toString('base64url')
        return { token, expiresAt: new Date(exp).toISOString(), exp }
      },
      verifySmeConnectCtaToken(token) {
        if (!token) return null
        try {
          const decoded = Buffer.from(String(token).trim(), 'base64url').toString('utf8')
          const parts = decoded.split(':')
          if (parts.length < 3) return null
          const sig = parts[parts.length - 1]
          const expStr = parts[parts.length - 2]
          const candidateId = parts.slice(0, -2).join(':')
          const exp = Number(expStr)
          if (!candidateId || !Number.isFinite(exp) || Date.now() > exp) return null
          const expected = signRaw(`${candidateId}:${exp}`)
          if (expected !== sig) return null
          return { candidateId, exp }
        } catch {
          return null
        }
      },
    }
  }
}

/**
 * @param {string} candidateId
 * @param {{ overrideRecipient?: string, actor?: { uid?: string, email?: string }, force?: boolean }} opts
 */
async function sendApprovedOutreach(candidateId, opts = {}) {
  const existing = await store.getRecommendation(candidateId)
  if (!existing) throw new Error('Recommendation not found')

  const status = String(existing.status || '')
  const allowed = [SME_CONNECT_STATUS.HUMAN_APPROVED, SME_CONNECT_STATUS.READY_FOR_OUTREACH]
  if (!opts.force && !allowed.includes(status)) {
    throw new Error(`Candidate status ${status} is not approved for outreach`)
  }

  const override = String(opts.overrideRecipient || '').trim().toLowerCase()
  const liveEmail = String(existing.contactEmail || existing.smeEmail || '')
    .trim()
    .toLowerCase()
  const recipient = override || liveEmail
  if (!recipient || !recipient.includes('@')) {
    throw new Error('No contact email on candidate')
  }

  // Safety: refuse live customer send unless override is set OR explicit allowLiveCustomers
  if (!override && opts.allowLiveCustomers !== true) {
    throw new Error(
      'Refusing live customer send — set overrideRecipient (test inbox) or allowLiveCustomers=true'
    )
  }

  const ctaUrl = buildCtaUrl(existing.id)
  const queued = await store.upsertRecommendation({
    ...existing,
    status: SME_CONNECT_STATUS.QUEUED,
    outreachQueuedAt: new Date().toISOString(),
    outreachRecipient: recipient,
    outreachOverrideRecipient: override || null,
    ctaUrl,
    customerNotified: false,
  })

  const sendResult = await sendViaResend({
    to: recipient,
    templateId: 'sme_connect_outreach',
    idempotencyKey: IdempotencyKeys.smeConnectOutreach(existing.id),
    input: {
      contactName: existing.contactName || existing.smeName,
      smeName: existing.smeName,
      companyName: existing.smeCompany || existing.smeName,
      smeCompany: existing.smeCompany,
      tenderNumber: existing.newTenderNumber || existing.tenderNumber,
      tenderDescription: existing.newTenderDescription || existing.tenderTitle,
      tenderTitle: existing.newTenderTitle || existing.tenderTitle,
      briefingDate: existing.briefingDate,
      briefingTime: existing.briefingTime,
      briefingVenue: existing.briefingVenue,
      ctaUrl,
    },
    meta: {
      eventType: 'sme_connect_outreach',
      entityId: existing.id,
      recipientUserId: existing.smeId || null,
    },
  })

  const providerMessageId =
    sendResult.providerMessageId || sendResult.id || existing.providerMessageId || null

  const next = await store.upsertRecommendation({
    ...queued,
    status: sendResult.sent
      ? SME_CONNECT_STATUS.SENT
      : sendResult.duplicate
        ? SME_CONNECT_STATUS.SENT
        : SME_CONNECT_STATUS.QUEUED,
    outreachStatus: sendResult.sent || sendResult.duplicate ? 'sent' : 'failed',
    providerMessageId,
    outreachSentAt: sendResult.sent || sendResult.duplicate ? new Date().toISOString() : null,
    outreachError: sendResult.error || null,
    customerNotified: Boolean(sendResult.sent || sendResult.duplicate),
    // delivery is provider-webhook driven — never mark delivered on API success alone
    providerDeliveryStatus: existing.providerDeliveryStatus || null,
  })

  await auditLogService.logEvent({
    type: 'sme_connect.outreach_send',
    entityId: existing.id,
    actorId: opts.actor?.uid || null,
    recipient,
    override: Boolean(override),
    sent: Boolean(sendResult.sent),
    duplicate: Boolean(sendResult.duplicate),
    providerMessageId,
  })

  return { candidate: next, sendResult, ctaUrl }
}

/**
 * Apply Resend lifecycle status to an SME Connect candidate by provider message id.
 * Does NOT treat API send success as delivered.
 */
async function applyProviderDeliveryByMessageId(providerMessageId, event = {}) {
  const msgId = String(providerMessageId || '').trim()
  if (!msgId) return { applied: false, reason: 'missing_message_id' }

  const all = await store.listRecommendations({ limit: 2000 })
  const candidate = (all || []).find((r) => r.providerMessageId === msgId)
  if (!candidate) return { applied: false, reason: 'not_sme_connect' }

  const status = String(event.status || '').toLowerCase()
  const patch = {
    ...candidate,
    providerDeliveryStatus: status || candidate.providerDeliveryStatus || null,
    providerDeliveryUpdatedAt: event.at || new Date().toISOString(),
    lastProviderEvent: event.reason || status || null,
  }

  if (status === 'delivered' && candidate.status === SME_CONNECT_STATUS.SENT) {
    patch.status = SME_CONNECT_STATUS.DELIVERED
    patch.outreachDeliveredAt = event.at || new Date().toISOString()
  } else if (status === 'bounced' || status === 'failed' || status === 'complained') {
    patch.status = SME_CONNECT_STATUS.BOUNCED
    patch.outreachBouncedAt = event.at || new Date().toISOString()
  }

  const saved = await store.upsertRecommendation(patch)
  return { applied: true, candidateId: saved.id, status: saved.status, providerDeliveryStatus: status }
}

module.exports = {
  sendApprovedOutreach,
  applyProviderDeliveryByMessageId,
  buildCtaUrl,
  requireCtaToken,
  appBaseUrl,
  absoluteUrl,
}
