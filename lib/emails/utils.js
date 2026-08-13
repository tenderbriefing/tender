const { EMAIL_TOKENS: T } = require('./tokens')

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstName(displayName, fallback = 'there') {
  const trimmed = String(displayName || '').trim()
  if (!trimmed) return fallback
  return trimmed.split(/\s+/)[0]
}

function baseUrl(env = process.env) {
  return (
    env.NEXT_PUBLIC_SITE_URL ||
    env.SITE_URL ||
    'https://www.tenderbriefing.co.za'
  ).replace(/\/$/, '')
}

function absoluteUrl(path, env = process.env) {
  const p = String(path || '')
  if (/^https?:\/\//i.test(p)) return p
  const normalized = p.startsWith('/') ? p : `/${p}`
  return `${baseUrl(env)}${normalized}`
}

function logoUrl(env = process.env) {
  return absoluteUrl(T.logoPath, env)
}

function formatMoneyCents(cents, currency = 'ZAR') {
  if (cents == null || cents === '' || Number.isNaN(Number(cents))) return 'n/a'
  const amount = Number(cents) / 100
  const cur = String(currency || 'ZAR').toUpperCase()
  if (cur === 'ZAR') return `R${amount.toFixed(2)}`
  return `${cur} ${amount.toFixed(2)}`
}

function formatDateLabel(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  try {
    return d.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Johannesburg',
    })
  } catch {
    return String(value)
  }
}

function formatDateTimeLabel(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  try {
    return d.toLocaleString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Johannesburg',
    })
  } catch {
    return String(value)
  }
}

/**
 * Resolve scheduled briefing instant from attendance request fields.
 * Prefer ISO briefingDate; append briefingTime when present.
 */
function resolveBriefingInstant(request = {}) {
  const dateRaw = String(request.briefingDate || '').trim()
  const timeRaw = String(request.briefingTime || '').trim()
  if (!dateRaw) return null

  // Already ISO datetime
  if (/T\d{2}:/.test(dateRaw)) {
    const d = new Date(dateRaw)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // Date-only YYYY-MM-DD (+ optional time HH:MM)
  const datePart = dateRaw.slice(0, 10)
  let hours = 9
  let minutes = 0
  const tm = timeRaw.match(/(\d{1,2}):(\d{2})/)
  if (tm) {
    hours = Math.min(23, parseInt(tm[1], 10))
    minutes = Math.min(59, parseInt(tm[2], 10))
  }
  // Interpret as SAST (UTC+2) without inventing meeting duration
  const iso = `${datePart}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+02:00`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Report SLA due: meetingEndedAt + 24h when known;
 * otherwise scheduled briefing instant + 24h (documented fallback —
 * platform does not store meeting duration / meetingEndedAt yet).
 */
function resolveReportDueAt(request = {}, now = new Date()) {
  void now
  if (request.reportDueAt) {
    const existing = new Date(request.reportDueAt)
    if (!Number.isNaN(existing.getTime())) return existing
  }
  if (request.meetingEndedAt) {
    const ended = new Date(request.meetingEndedAt)
    if (!Number.isNaN(ended.getTime())) {
      return new Date(ended.getTime() + 24 * 60 * 60 * 1000)
    }
  }
  const briefing = resolveBriefingInstant(request)
  if (!briefing) return null
  return new Date(briefing.getTime() + 24 * 60 * 60 * 1000)
}

function sliceStr(value, max = 200) {
  return String(value || '').trim().slice(0, max)
}

module.exports = {
  escapeHtml,
  firstName,
  baseUrl,
  absoluteUrl,
  logoUrl,
  formatMoneyCents,
  formatDateLabel,
  formatDateTimeLabel,
  resolveBriefingInstant,
  resolveReportDueAt,
  sliceStr,
}
