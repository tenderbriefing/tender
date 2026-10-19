/**
 * Phase 19 — exception queue helpers.
 */
const { EXCEPTION_CATEGORY } = require('../domain/ocdsDayReconciliation')
const store = require('./parityExceptionStore')

async function raiseException({
  category,
  date = null,
  tenderNumber = null,
  ocid = null,
  title = null,
  detail = null,
  payload = null,
}) {
  if (!EXCEPTION_CATEGORY[category] && !Object.values(EXCEPTION_CATEGORY).includes(category)) {
    throw new Error(`Unknown exception category: ${category}`)
  }
  return store.upsertException({
    category,
    date,
    tenderNumber,
    ocid,
    title,
    detail: detail ? String(detail).slice(0, 800) : null,
    payload: payload || null,
    status: 'OPEN',
  })
}

async function listOpenExceptions(opts = {}) {
  return store.listExceptions({ ...opts, status: opts.status || 'OPEN' })
}

async function summarizeExceptions() {
  const open = await store.listExceptions({ status: 'OPEN', limit: 2000 })
  const byCategory = {}
  for (const row of open) {
    byCategory[row.category] = (byCategory[row.category] || 0) + 1
  }
  return { openCount: open.length, byCategory, sample: open.slice(0, 50) }
}

module.exports = {
  EXCEPTION_CATEGORY,
  raiseException,
  listOpenExceptions,
  summarizeExceptions,
  resolveException: store.resolveException,
}
