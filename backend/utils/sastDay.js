/**
 * Africa/Johannesburg calendar helpers for Founder commercial reporting.
 * Keep aligned with lib/seo/compulsoryBriefingPeriods formatSastYmd.
 */
const SAST = 'Africa/Johannesburg'

function formatSastYmd(ref = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref)
}

function sastDayKeyFromIso(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return formatSastYmd(d)
}

function sastDayKeyFromMs(ms) {
  if (!Number.isFinite(ms)) return null
  return formatSastYmd(new Date(ms))
}

module.exports = {
  SAST_TIMEZONE: SAST,
  formatSastYmd,
  sastDayKeyFromIso,
  sastDayKeyFromMs,
}
