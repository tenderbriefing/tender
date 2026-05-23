/**
 * Shared helpers for integration modules — never log or return secret values.
 */

function env(name) {
  const value = process.env[name]
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function hasEnv(name) {
  return env(name).length > 0
}

function checkRequired(names) {
  const missing = names.filter((name) => !hasEnv(name))
  return {
    configured: missing.length === 0,
    missing,
    present: names.filter((name) => hasEnv(name)),
  }
}

function integrationResult({
  id,
  name,
  status,
  requiredEnv = [],
  missing = [],
  setupNotes = '',
  message = '',
  checkedAt = new Date().toISOString(),
}) {
  return {
    id,
    name,
    status,
    requiredEnv,
    missing,
    setupNotes,
    message,
    lastChecked: checkedAt,
  }
}

function statusFromConfig(configured, errorMessage) {
  if (errorMessage) return 'error'
  return configured ? 'configured' : 'missing'
}

module.exports = {
  env,
  hasEnv,
  checkRequired,
  integrationResult,
  statusFromConfig,
}
