/**
 * Resend-powered welcome emails for new SME and Youth Agent registrations.
 * Server-only — never import from client components.
 */
import type { WelcomeEmailInput, WelcomeEmailResult, WelcomeEmailRole } from './welcomeEmailTypes'

// Shared CJS transactional email service
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tx = require('./transactionalEmailService')

export type { WelcomeEmailInput, WelcomeEmailResult, WelcomeEmailRole }

export function isWelcomeEmailRole(value: unknown): value is WelcomeEmailRole {
  return value === 'sme' || value === 'youth-agent'
}

export function buildWelcomeEmailTemplate(input: WelcomeEmailInput) {
  if (input.userType === 'youth-agent') {
    return tx.renderEmailTemplate('youth_agent_welcome', input)
  }
  return tx.renderEmailTemplate('sme_welcome', input)
}

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<WelcomeEmailResult> {
  const to = (input.to || '').trim().toLowerCase()
  if (!to || !to.includes('@')) {
    return { sent: false, skipped: true, error: 'Invalid recipient email' }
  }
  if (!isWelcomeEmailRole(input.userType)) {
    return { sent: false, skipped: true, error: 'Unsupported user type for welcome email' }
  }

  const payload = {
    to,
    email: to,
    uid: input.uid,
    displayName: input.displayName?.trim() || to.split('@')[0] || 'there',
    companyName: input.companyName,
  }

  const result =
    input.userType === 'youth-agent'
      ? await tx.sendYouthAgentWelcomeEmailSafe(payload)
      : await tx.sendSmeWelcomeEmailSafe(payload)

  return {
    sent: Boolean(result.sent),
    skipped: Boolean(result.skipped),
    error: result.error,
    id: result.id,
  }
}

export async function sendWelcomeEmailSafe(input: WelcomeEmailInput): Promise<WelcomeEmailResult> {
  try {
    return await sendWelcomeEmail(input)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Welcome email failed'
    console.error('[welcomeEmail] Safe send caught:', err)
    return { sent: false, error: message }
  }
}
