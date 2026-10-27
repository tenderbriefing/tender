const { checkRequired, integrationResult } = require('./integrationConfig')

const REQUIRED_ENV = ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET']

function getConfig() {
  return checkRequired(REQUIRED_ENV)
}

function getStatus() {
  const config = getConfig()
  // Never report "configured" for this scaffold — admin UI must not imply live Calendar sync.
  return integrationResult({
    id: 'google_calendar',
    name: 'Google Calendar API',
    status: 'scaffold',
    requiredEnv: REQUIRED_ENV,
    missing: config.missing,
    setupNotes:
      'Scaffold only. Production briefing calendar export uses ICS / Google Calendar deep links on tender pages. Full OAuth calendar sync is not live — do not treat env presence as production readiness.',
    message: config.configured
      ? 'OAuth client env present, but Calendar sync remains a scaffold (not production).'
      : 'Not required for launch — ICS export covers SME calendar add.',
  })
}

async function listEventsPlaceholder() {
  return {
    ok: false,
    skipped: true,
    future: true,
    reason: 'Google Calendar OAuth sync is a scaffold — use ICS / deep-link export instead',
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
