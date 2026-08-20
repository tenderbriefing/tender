import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Youth Agent auth UI — single submission guards', () => {
  const signInPath = path.resolve(__dirname, '../../app/auth/signin/page.tsx')
  const signUpPath = path.resolve(__dirname, '../../app/auth/signup/page.tsx')
  const authLibPath = path.resolve(__dirname, '../../lib/auth.ts')

  it('sign-in page uses submit lock and disables while loading', () => {
    const src = fs.readFileSync(signInPath, 'utf8')
    expect(src).toContain('submitLock')
    expect(src).toContain('if (submitLock.current || loading || googleLoading) return')
    expect(src).toContain('disabled={loading || googleLoading}')
    expect(src).toContain('e.preventDefault()')
  })

  it('sign-up page uses submit lock and disables while loading', () => {
    const src = fs.readFileSync(signUpPath, 'utf8')
    expect(src).toContain('submitLock')
    expect(src).toContain('if (submitLock.current || loading || googleLoading) return')
    expect(src).toContain('disabled={loading || googleLoading}')
    expect(src).toContain('e.preventDefault()')
  })

  it('signUp does not fall back to signInWithEmailAndPassword on email-already-in-use', () => {
    const src = fs.readFileSync(authLibPath, 'utf8')
    // Ensure createUser is used; orphan silent sign-in loop removed from signUp.
    expect(src).toContain('createUserWithEmailAndPassword')
    const signUpBlock = src.slice(src.indexOf('export const signUp'), src.indexOf('export const signIn'))
    expect(signUpBlock).not.toContain('signInWithEmailAndPassword')
    expect(signUpBlock).toContain('exactly one createUserWithEmailAndPassword')
  })

  it('signIn does not call createUserWithEmailAndPassword', () => {
    const src = fs.readFileSync(authLibPath, 'utf8')
    const signInBlock = src.slice(src.indexOf('export const signIn'), src.indexOf('const PRODUCTION_AUTH_CONTINUE_URL'))
    expect(signInBlock).toContain('signInWithEmailAndPassword')
    expect(signInBlock).not.toContain('createUserWithEmailAndPassword')
    expect(signInBlock).toContain('exactly one signInWithEmailAndPassword')
  })
})

describe('authFetch token refresh contract', () => {
  it('implements at most one forced refresh after 401', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../lib/api/authenticatedFetch.ts'),
      'utf8'
    )
    expect(src).toContain('forceRefresh: true')
    expect(src).toContain('first.status !== 401')
    expect(src).toContain('waitForAuthUser')
  })
})

describe('WorkspaceGate redirect param', () => {
  it('uses redirect= so sign-in returns to workspace', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../components/agent/workspace/WorkspaceGate.tsx'),
      'utf8'
    )
    expect(src).toContain('/auth/signin?redirect=/agent/workspace/today')
    expect(src).not.toContain('?next=/agent/workspace')
  })
})

describe('CSP connect-src includes DoubleClick GA beacon host', () => {
  it('allows stats.g.doubleclick.net without scheme-wide https: allowlist', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../next.config.js'), 'utf8')
    expect(src).toContain('https://stats.g.doubleclick.net')
    const connect = src.match(/"connect-src[^"]+"/)?.[0] || ''
    // Must not allow all HTTPS origins via bare `https:` token.
    expect(connect.split(/\s+/)).not.toContain('https:')
    expect(connect.split(/\s+/)).not.toContain('*')
  })
})
