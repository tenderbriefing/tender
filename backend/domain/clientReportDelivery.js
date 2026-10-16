/**
 * Phase 12 — Client report delivery domain constants & helpers.
 * REPORT READY never means EMAIL SENT.
 */

const DELIVERY_STATUSES = [
  'delivery_review',
  'send_pending',
  'sending',
  'sent',
  'delivered',
  'failed',
  'bounced',
]

const DELIVERY_STATUS_LABELS = {
  delivery_review: 'Delivery Review',
  send_pending: 'Send Pending',
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
  bounced: 'Bounced',
}

const TERMINAL_SUCCESS = new Set(['sent', 'delivered'])
const BLOCKS_DUPLICATE_SEND = new Set(['sending', 'sent', 'delivered'])

function isValidEmail(value) {
  const s = String(value || '')
    .trim()
    .toLowerCase()
  if (!s || s.length > 200) return false
  // Practical validation — not inventing RFC complete parser
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function normalizeEmailList(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,;]+/)
        .map((s) => s.trim())
  return raw
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean)
}

function assertRecipientList(toList) {
  if (!toList.length) throw new Error('At least one recipient is required')
  for (const email of toList) {
    if (!isValidEmail(email)) throw new Error(`Invalid recipient email: ${email}`)
  }
}

function defaultSubject({ tenderNumber, tenderDescription }) {
  const num = String(tenderNumber || '').trim() || 'Tender'
  const desc = String(tenderDescription || '').trim()
  const base = desc
    ? `Tender Briefing Report — ${num} — ${desc}`
    : `Tender Briefing Report — ${num}`
  return base.slice(0, 180)
}

function defaultBody({
  clientName,
  companyName,
  tenderNumber,
  tenderDescription,
}) {
  const name = String(clientName || companyName || 'Client').trim() || 'Client'
  const company = String(companyName || name).trim()
  const num = String(tenderNumber || '—').trim()
  const desc = String(tenderDescription || 'the tender briefing').trim()
  return [
    `Dear ${name},`,
    '',
    `Please find attached the Tender Briefing Report for ${num} — ${desc}.`,
    '',
    `The report summarises the compulsory briefing/site meeting attended on behalf of ${company}, including the key requirements, clarifications, observations and supporting evidence captured during the briefing.`,
    '',
    'Please review the attached report together with the official tender documentation before preparing your final submission.',
    '',
    'Kind regards,',
    '',
    'TenderBriefing',
    'www.tenderbriefing.co.za',
  ].join('\n')
}

function buildIdempotencyKey(requestId, reportVersionId, deliveryId) {
  return `CLIENT_REPORT_DELIVERY:${requestId}:${reportVersionId}:${deliveryId}`.slice(0, 200)
}

function stripInternalLeakHints(text) {
  const blob = String(text || '')
  if (/agentPayoutCents|representativePayoutCents|representativeInternalNotes|INTERNAL_PAYOUT|Youth Agent payout/i.test(blob)) {
    throw new Error('Client delivery content must not include internal payout or private ops notes')
  }
  return blob
}

module.exports = {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_LABELS,
  TERMINAL_SUCCESS,
  BLOCKS_DUPLICATE_SEND,
  isValidEmail,
  normalizeEmailList,
  assertRecipientList,
  defaultSubject,
  defaultBody,
  buildIdempotencyKey,
  stripInternalLeakHints,
}
