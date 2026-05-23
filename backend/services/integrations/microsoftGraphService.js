const { checkRequired, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = [
  'MICROSOFT_GRAPH_CLIENT_ID',
  'MICROSOFT_GRAPH_CLIENT_SECRET',
  'MICROSOFT_GRAPH_TENANT_ID',
]

function getConfig() {
  return checkRequired(REQUIRED_ENV)
}

function getStatus() {
  const config = getConfig()
  return integrationResult({
    id: 'microsoft_graph',
    name: 'Microsoft Graph',
    status: statusFromConfig(config.configured),
    requiredEnv: REQUIRED_ENV,
    missing: config.missing,
    setupNotes:
      'Future: Outlook calendar and mailbox integration for enterprise SMEs.',
  })
}

async function listCalendarEventsPlaceholder() {
  if (!getConfig().configured) {
    return { ok: false, skipped: true, reason: 'Microsoft Graph not configured' }
  }
  return {
    ok: true,
    future: true,
    message: 'Microsoft Graph scaffold — register app in Azure AD before production use.',
  }
}

async function healthCheck() {
  return getStatus()
}

module.exports = {
  REQUIRED_ENV,
  getConfig,
  getStatus,
  listCalendarEventsPlaceholder,
  healthCheck,
}
