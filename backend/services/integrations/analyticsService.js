const { env, hasEnv, integrationResult, statusFromConfig } = require('./integrationConfig')

const GA4_ENV = ['NEXT_PUBLIC_GA_MEASUREMENT_ID']
const SEARCH_CONSOLE_ENV = ['GOOGLE_SITE_VERIFICATION']

function getGa4Status() {
  const configured = hasEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID')
  return integrationResult({
    id: 'ga4',
    name: 'Google Analytics 4',
    status: statusFromConfig(configured),
    requiredEnv: GA4_ENV,
    missing: configured ? [] : GA4_ENV,
    setupNotes:
      'Create GA4 property, add web stream, set NEXT_PUBLIC_GA_MEASUREMENT_ID (G-XXXXXXXX).',
  })
}

function getSearchConsoleStatus() {
  const configured = hasEnv('GOOGLE_SITE_VERIFICATION')
  return integrationResult({
    id: 'search_console',
    name: 'Google Search Console',
    status: statusFromConfig(configured),
    requiredEnv: SEARCH_CONSOLE_ENV,
    missing: configured ? [] : SEARCH_CONSOLE_ENV,
    setupNotes:
      'Add HTML meta tag verification in Search Console; set GOOGLE_SITE_VERIFICATION to the content value.',
  })
}

function getStatus() {
  return getGa4Status()
}

async function healthCheck() {
  return {
    ga4: getGa4Status(),
    searchConsole: getSearchConsoleStatus(),
  }
}

module.exports = {
  GA4_ENV,
  SEARCH_CONSOLE_ENV,
  getGa4Status,
  getSearchConsoleStatus,
  getStatus,
  healthCheck,
}
