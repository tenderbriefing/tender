import { createHash, randomBytes } from 'crypto'

const CODE_LEN = 6
const MODULUS = 36 ** CODE_LEN // 36^6 ~ 2.17e9

function toTbBrCodeFromHex(hex: string) {
  // Use a deterministic, bounded number so the output is always 6 chars.
  const n = parseInt(hex.slice(0, 10), 16) % MODULUS
  return n.toString(36).toUpperCase().padStart(CODE_LEN, '0')
}

/**
 * Generate TB-BR-XXXXXX IDs that are durable (same inputs -> same ID) and
 * non-sequential (hash-based).
 */
export function generateBriefingIntelligenceReportId(input: {
  requestId: string
  agentId: string
  // Optional extra input to reduce accidental collisions across evolving workflows.
  // (e.g. tenderId, evidence batch marker, etc)
  salt?: string
}): string {
  const { requestId, agentId, salt = '' } = input
  const seed = `${requestId}:${agentId}:${salt}`
  const hex = createHash('sha256').update(seed).digest('hex')
  const code = toTbBrCodeFromHex(hex)
  return `TB-BR-${code}`
}

/**
 * Fallback non-sequential ID generator for internal tools/testing.
 * Not used by the main evidence pipeline (which needs determinism).
 */
export function generateRandomBriefingIntelligenceReportId(): string {
  const bytes = randomBytes(8).toString('hex')
  const code = toTbBrCodeFromHex(bytes)
  return `TB-BR-${code}`
}

