const { env, hasEnv, checkRequired, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET']

function getConfig() {
  return checkRequired(REQUIRED_ENV)
}

function getStatus() {
  const config = getConfig()
  return integrationResult({
    id: 'google_calendar',
    name: 'Google Calendar API',
    status: statusFromConfig(config.configured),
    requiredEnv: REQUIRED_ENV,
    missing: config.missing,
    setupNotes:
      'Future: OAuth consent for calendar sync and ICS export. Tender calendar events currently use in-app scheduling.',
  })
}

async function listEventsPlaceholder() {
  if (!getConfig().configured) {
    return { ok: false, skipped: true, reason: 'Google Calendar not configured' }
  }
  return {
    ok: true,
    future: true,
    message: 'Calendar API integration scaffold — implement OAuth flow before production use.',
  }
}

async function healthCheck() {
  return getStatus()
}

module.exports = {
  REQUIRED_ENV,
  getConfig,
  getStatus,
  listEventsPlaceholder,
  healthCheck,
}
