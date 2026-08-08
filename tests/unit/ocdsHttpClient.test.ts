import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

describe('ocdsHttpClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any

  beforeEach(() => {
    delete process.env.OCDS_API_BASE
    const keys = Object.keys(require.cache).filter((k) => k.includes('ocdsHttpClient'))
    for (const k of keys) delete require.cache[k]
    client = require('../../backend/services/ocdsHttpClient')
    client.resetSharedDispatcher()
  })

  afterEach(() => {
    delete process.env.OCDS_API_BASE
    client?.resetSharedDispatcher?.()
    vi.restoreAllMocks()
  })

  it('uses default OCDS base and optional OCDS_API_BASE override', () => {
    expect(client.getOcdsApiBase()).toBe(client.DEFAULT_OCDS_API_BASE)
    process.env.OCDS_API_BASE = 'https://example.test/api/OCDSReleases/'
    expect(client.getOcdsApiBase()).toBe('https://example.test/api/OCDSReleases')
  })

  it('raises connect timeout above undici 10s default without sacrificing request budget', () => {
    expect(client.CONNECT_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000)
    expect(client.CONNECT_TIMEOUT_MS).toBeLessThanOrEqual(30_000)
    expect(client.REQUEST_TIMEOUT_MS).toBe(120_000)
    expect(client.MAX_ATTEMPTS).toBe(3)
  })

  it('classifies connect timeouts and socket resets as retryable', () => {
    const connectTimeout = Object.assign(new Error('fetch failed'), {
      cause: Object.assign(new Error('Connect Timeout Error (timeout: 10000ms)'), {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        name: 'ConnectTimeoutError',
      }),
    })
    expect(client.isRetryableFetchError(connectTimeout)).toBe(true)

    const reset = Object.assign(new Error('fetch failed'), {
      cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    })
    expect(client.isRetryableFetchError(reset)).toBe(true)

    const auth = new Error('Unauthorized')
    expect(client.isRetryableFetchError(auth)).toBe(false)
  })

  it('retries connect timeouts with backoff then succeeds', async () => {
    const sleeps: number[] = []
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('fetch failed'), {
          cause: Object.assign(new Error('Connect Timeout Error'), {
            code: 'UND_ERR_CONNECT_TIMEOUT',
          }),
        })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ releases: [] }),
      })

    const response = await client.fetchWithRetry('https://example.test/ocds', {
      fetchImpl,
      sleepFn: async (ms: number) => {
        sleeps.push(ms)
      },
    })

    expect(response.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleeps).toHaveLength(1)
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000)
  })

  it('retries retryable gateway statuses then returns success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        arrayBuffer: async () => new ArrayBuffer(0),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(0),
      })

    const response = await client.fetchWithRetry('https://example.test/ocds', {
      fetchImpl,
      sleepFn: async () => {},
    })

    expect(response.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('stops after bounded attempts on persistent connect timeout', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(
      Object.assign(new Error('fetch failed'), {
        cause: Object.assign(new Error('Connect Timeout Error'), {
          code: 'UND_ERR_CONNECT_TIMEOUT',
        }),
      })
    )

    await expect(
      client.fetchWithRetry('https://example.test/ocds', {
        fetchImpl,
        maxAttempts: 3,
        sleepFn: async () => {},
      })
    ).rejects.toThrow(/OCDS fetch failed after 3 attempts/)

    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('does not retry non-transient client errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('Unexpected parser boom'))

    await expect(
      client.fetchWithRetry('https://example.test/ocds', {
        fetchImpl,
        sleepFn: async () => {},
      })
    ).rejects.toThrow('Unexpected parser boom')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('formats nested undici causes for admin UI surfacing', () => {
    const error = Object.assign(new Error('fetch failed'), {
      cause: Object.assign(new Error('Connect Timeout Error (timeout: 10000ms)'), {
        code: 'UND_ERR_CONNECT_TIMEOUT',
      }),
    })
    expect(client.formatFetchError(error)).toBe(
      'fetch failed (Connect Timeout Error (timeout: 10000ms))'
    )
  })
})
