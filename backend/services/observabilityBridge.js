/**
 * Tiny bridge so CommonJS backend can emit structured logs without TS import.
 */
function logEvent(payload) {
  try {
    // Prefer TS logger when compiled path unavailable — duplicate minimal scrub
    const entry = {
      severity: payload.severity || 'info',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      ...payload,
    }
    const line = JSON.stringify(entry)
    if (entry.severity === 'error') console.error(line)
    else if (entry.severity === 'warn') console.warn(line)
    else console.log(line)
  } catch {
    // never throw from logger
  }
}

module.exports = { logEvent }
