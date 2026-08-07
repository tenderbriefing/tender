/** Canonical shareable SME funnel for Youth Agent briefing attendance. */

export const SME_BOOK_AGENT_PATH = '/sme/book-agent'

export function requestAgentPath(tenderId: string): string {
  return `/tenders/${tenderId}/request-agent`
}

/** Sign-in return URL: deep-link to checkout when tenderId is known. */
export function smeBookAgentSignInHref(tenderId?: string | null): string {
  const returnPath =
    tenderId && tenderId.trim()
      ? requestAgentPath(tenderId.trim())
      : SME_BOOK_AGENT_PATH
  return `/auth/signin?redirect=${encodeURIComponent(returnPath)}`
}
