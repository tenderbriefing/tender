/**
 * Preserve post-auth return paths without open redirects.
 * Only same-origin relative paths (starting with `/`, not `//`) are allowed.
 */
export function isSafeReturnPath(path: string | null | undefined): boolean {
  if (!path || typeof path !== 'string') return false
  const trimmed = path.trim()
  if (!trimmed.startsWith('/')) return false
  if (trimmed.startsWith('//')) return false
  if (trimmed.includes('://')) return false
  return true
}

/** Build `/auth/signin?redirect=…` for a trusted internal path. */
export function signInWithReturnHref(returnPath: string): string {
  if (!isSafeReturnPath(returnPath)) return '/auth/signin'
  return `/auth/signin?redirect=${encodeURIComponent(returnPath.trim())}`
}

/** Append or merge `redirect` onto an auth path (role-selection, etc.). */
export function withReturnRedirect(authPath: string, returnPath: string | null | undefined): string {
  if (!isSafeReturnPath(returnPath)) return authPath
  const sep = authPath.includes('?') ? '&' : '?'
  return `${authPath}${sep}redirect=${encodeURIComponent(returnPath!.trim())}`
}
