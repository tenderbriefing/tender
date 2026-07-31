export type LogSeverity = 'debug' | 'info' | 'warn' | 'error'

export interface StructuredLog {
  event: string
  severity?: LogSeverity
  timestamp?: string
  requestId?: string
  userId?: string
  role?: string
  attendanceRequestId?: string
  paymentId?: string
  tenderId?: string
  agentId?: string
  environment?: string
  outcome?: 'success' | 'failure' | 'denied' | 'ignored' | 'duplicate'
  errorCode?: string
  durationMs?: number
  retryCount?: number
  [key: string]: unknown
}

const REDACT_KEYS = new Set([
  'password',
  'passphrase',
  'token',
  'authorization',
  'secret',
  'apiKey',
  'merchant_key',
  'signature',
])

function scrub(value: unknown): unknown {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(scrub)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k) || /passphrase|secret|token|password/i.test(k)) {
        out[k] = '[redacted]'
      } else {
        out[k] = scrub(v)
      }
    }
    return out
  }
  return value
}

export function logEvent(payload: StructuredLog): void {
  const entry = scrub({
    ...payload,
    severity: payload.severity || 'info',
    timestamp: payload.timestamp || new Date().toISOString(),
    environment: payload.environment || process.env.NODE_ENV || 'unknown',
  })
  const line = JSON.stringify(entry)
  const sev = payload.severity || 'info'
  if (sev === 'error') console.error(line)
  else if (sev === 'warn') console.warn(line)
  else console.log(line)
}

export function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
