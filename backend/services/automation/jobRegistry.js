const CURSOR_VERSION = 1

const JOB_DEFINITIONS = Object.freeze([
  { name: 'tender_closing_reminders', priority: 10, minStartMs: 8_000, retry: 'hourly', sideEffects: true },
  { name: 'briefing_reminders', priority: 20, minStartMs: 8_000, retry: 'hourly', sideEffects: true },
  { name: 'missed_briefing_detection', priority: 30, minStartMs: 10_000, retry: 'hourly', sideEffects: true },
  { name: 'report_sla_emails', priority: 35, minStartMs: 12_000, retry: 'hourly', sideEffects: true },
  { name: 'retry_failed_whatsapp', priority: 40, minStartMs: 20_000, retry: 'bounded_20', sideEffects: true },
  { name: 'sla_escalations', priority: 50, minStartMs: 12_000, retry: 'hourly', sideEffects: true },
  { name: 'smart_dispatch', priority: 60, minStartMs: 15_000, retry: 'hourly', sideEffects: true },
  { name: 'smart_escalation', priority: 70, minStartMs: 15_000, retry: 'hourly', sideEffects: true },
  { name: 'no_show_prediction', priority: 80, minStartMs: 15_000, retry: 'hourly', sideEffects: false },
  { name: 'daily_procurement_brief', priority: 90, minStartMs: 25_000, retry: 'continuation', sideEffects: true, batchSize: 5 },
  { name: 'procurement_watchlists', priority: 100, minStartMs: 20_000, retry: 'continuation', sideEffects: false, batchSize: 5 },
  { name: 'procurement_memory', priority: 110, minStartMs: 15_000, retry: 'hourly', sideEffects: false },
  { name: 'procurement_forecasting', priority: 120, minStartMs: 15_000, retry: 'hourly', sideEffects: false },
  { name: 'calendar_intelligence', priority: 130, minStartMs: 15_000, retry: 'continuation', sideEffects: false, batchSize: 200 },
  { name: 'smart_procurement_ingestion', priority: 140, minStartMs: 40_000, retry: 'continuation', sideEffects: true, batchSize: 2 },
])

const JOB_REGISTRY = new Map(JOB_DEFINITIONS.map((definition) => [definition.name, Object.freeze(definition)]))

function listJobs() {
  return [...JOB_DEFINITIONS].sort((a, b) => a.priority - b.priority)
}

function getJobDefinition(name) {
  return JOB_REGISTRY.get(name) || null
}

function validateJobName(name) {
  return name === 'all' || JOB_REGISTRY.has(name)
}

function encodeContinuation(payload) {
  const json = JSON.stringify({ v: CURSOR_VERSION, ...payload })
  return Buffer.from(json, 'utf8').toString('base64url')
}

function decodeContinuation(cursor) {
  if (!cursor) return null
  try {
    const decoded = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'))
    if (decoded?.v !== CURSOR_VERSION) return null
    return decoded
  } catch {
    return null
  }
}

module.exports = {
  CURSOR_VERSION,
  JOB_DEFINITIONS,
  JOB_REGISTRY,
  listJobs,
  getJobDefinition,
  validateJobName,
  encodeContinuation,
  decodeContinuation,
}
