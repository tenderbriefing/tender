/**
 * Bounded hot-path log lines. Never pass secrets, tokens, or PII.
 */
function logHotPath(fields) {
  const payload = {
    event: 'hot_path',
    ts: new Date().toISOString(),
    ...fields,
  }
  console.info(JSON.stringify(payload))
}

module.exports = { logHotPath }
