import { describe, expect, it, beforeEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

describe('distributedRateLimit (memory backend)', () => {
  let checkDistributedRateLimit: (
    key: string,
    limit: number,
    windowMs: number
  ) => Promise<{ allowed: boolean; retryAfterSec?: number }>
  let memoryFallback: (
    key: string,
    limit: number,
    windowMs: number
  ) => { allowed: boolean; retryAfterSec?: number }

  beforeEach(() => {
    process.env.RATE_LIMIT_BACKEND = 'memory'
    const keys = Object.keys(require.cache).filter((k) => k.includes('distributedRateLimit'))
    for (const k of keys) delete require.cache[k]
    const mod = require('../../backend/services/security/distributedRateLimit')
    checkDistributedRateLimit = mod.checkDistributedRateLimit
    memoryFallback = mod.memoryFallback
  })

  it('allows under limit and blocks at ceiling', async () => {
    const key = `unit-test-${Date.now()}`
    expect((await checkDistributedRateLimit(key, 2, 60_000)).allowed).toBe(true)
    expect((await checkDistributedRateLimit(key, 2, 60_000)).allowed).toBe(true)
    const blocked = await checkDistributedRateLimit(key, 2, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('memoryFallback isolates buckets by key', () => {
    const a = `a-${Date.now()}`
    const b = `b-${Date.now()}`
    expect(memoryFallback(a, 1, 60_000).allowed).toBe(true)
    expect(memoryFallback(a, 1, 60_000).allowed).toBe(false)
    expect(memoryFallback(b, 1, 60_000).allowed).toBe(true)
  })
})
