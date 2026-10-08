/**
 * Verified TenderBriefing sender identities for Founder Outreach.
 * Never allow arbitrary From spoofing.
 */
import { fromAddress } from '@/lib/services/founderOutreachEmail'

export type AuthorizedSender = {
  id: string
  display: string
  email: string
}

function parseDisplay(from: string): { display: string; email: string } {
  const m = /^(.*?)<([^>]+)>\s*$/.exec(from.trim())
  if (m) {
    return { display: from.trim(), email: m[2].trim().toLowerCase() }
  }
  const email = from.trim().toLowerCase()
  return { display: `TenderBriefing <${email}>`, email }
}

export function listAuthorizedOutreachSenders(
  env: NodeJS.ProcessEnv = process.env
): AuthorizedSender[] {
  const primary = parseDisplay(fromAddress(env))
  return [
    {
      id: 'primary',
      display: primary.display,
      email: primary.email,
    },
  ]
}

/** Default primary sender when client omits senderId. */
export function defaultAuthorizedSender(
  env: NodeJS.ProcessEnv = process.env
): AuthorizedSender {
  return listAuthorizedOutreachSenders(env)[0]
}

/**
 * Resolve a requested sender id. Unknown / spoofed ids are rejected (null).
 * Empty/missing id → primary (authorized default).
 */
export function resolveAuthorizedSender(
  requestedId: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env
): AuthorizedSender | null {
  const list = listAuthorizedOutreachSenders(env)
  const raw = String(requestedId ?? '').trim()
  if (!raw) return list[0]
  return list.find((s) => s.id === raw) || null
}

export function isAuthorizedSenderId(
  requestedId: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return resolveAuthorizedSender(requestedId, env) != null
}
