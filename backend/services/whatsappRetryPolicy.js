/**
 * Production safety — which WhatsApp notification docs may be retried by automation.
 */

const BLOCKED_TYPES = new Set([
  'admin_test',
  'qa_test',
  'qa_dup',
  'idempotency_marker',
])

/** Operational types allowed to retry even with short templated bodies */
const OPERATIONAL_TYPES = new Set([
  'agent_new_opportunity',
  'agent_payment_confirmed',
  'sme_attendance_submitted',
  'sme_agent_assigned',
  'agent_request_accepted',
  'sme_report_uploaded',
  'admin_report_uploaded',
  'admin_payment_failed',
  'sme_closing_reminder',
  'agent_briefing_reminder',
  'admin_request_spike',
  'briefing_missed',
  'payment_confirmed',
  'pilot_outreach',
])

const QA_PHONE = '+27720708467'

function notificationMessage(row) {
  return String(row?.message || row?.body || '').trim()
}

function normalizePhone(to) {
  return String(to || '')
    .replace(/^whatsapp:/i, '')
    .replace(/\s/g, '')
}

function metadataSource(row) {
  const meta = row?.metadata || {}
  return String(meta.source || meta.origin || '').toLowerCase()
}

function isQaOrTestNotification(row, { forRetry = true } = {}) {
  const type = String(row?.type || '')
  const msg = notificationMessage(row).toLowerCase()
  const meta = row?.metadata || {}
  const to = normalizePhone(row?.to)

  if (forRetry && BLOCKED_TYPES.has(type)) return true
  if (type.startsWith('qa_')) return true
  if (meta.testMode === true) return true
  if (metadataSource(row).includes('qa')) return true
  if (msg === 'dup2') return true
  if (to === QA_PHONE && type === 'qa_dup') return true
  if (String(row?.id || '').startsWith('wa-idem-')) return true

  return false
}

function isShortNonOperational(row) {
  const type = String(row?.type || '')
  const msg = notificationMessage(row)
  if (msg.length >= 10) return false
  if (OPERATIONAL_TYPES.has(type)) return false
  return msg.length > 0
}

/**
 * @returns {{ blocked: boolean, reason?: string }}
 */
function getWhatsAppRetryBlockReason(row) {
  if (!row) return { blocked: true, reason: 'missing_row' }

  if (row.status === 'archived' || row.retryable === false) {
    return { blocked: true, reason: 'already_archived' }
  }

  if (row.status === 'retried' || row.status === 'sent') {
    return { blocked: true, reason: 'already_completed' }
  }

  if (isQaOrTestNotification(row)) {
    return { blocked: true, reason: 'qa_or_test' }
  }

  if (isShortNonOperational(row)) {
    return { blocked: true, reason: 'short_non_operational' }
  }

  return { blocked: false }
}

function isWhatsAppRetryAllowed(row) {
  return !getWhatsAppRetryBlockReason(row).blocked
}

function shouldArchiveQaNotification(row) {
  const type = String(row?.type || '')
  const msg = notificationMessage(row).toLowerCase()
  if (['qa_dup', 'qa_test', 'admin_test', 'idempotency_marker'].includes(type)) return true
  if (type.startsWith('qa_')) return true
  if (msg === 'dup2') return true
  if (isQaOrTestNotification(row)) return true
  return false
}

module.exports = {
  BLOCKED_TYPES,
  OPERATIONAL_TYPES,
  QA_PHONE,
  notificationMessage,
  isQaOrTestNotification,
  isWhatsAppRetryAllowed,
  getWhatsAppRetryBlockReason,
  shouldArchiveQaNotification,
}
