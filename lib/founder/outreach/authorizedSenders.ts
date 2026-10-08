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

export function resolveAuthorizedSender(
  requestedId: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env
): AuthorizedSender {
  const list = listAuthorizedOutreachSenders(env)
  return list.find((s) => s.id === requestedId) || list[0]
}
