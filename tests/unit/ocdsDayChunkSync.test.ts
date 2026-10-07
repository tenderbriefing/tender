import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

describe('OCDS day-chunk sync', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sync: any

  beforeEach(() => {
    const keys = Object.keys(require.cache).filter(
      (k) => k.includes('incrementalSyncService') || k.includes('ocdsHttpClient')
    )
    for (const k of keys) delete require.cache[k]
    sync = require('../../backend/services/incrementalSyncService')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('enumerates inclusive calendar days', () => {
    expect(sync.eachDateInclusive('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ])
    expect(sync.eachDateInclusive('2026-10-07', '2026-10-07')).toEqual(['2026-10-07'])
  })

  it('treats OCDS 500/502/503/504 as skippable day errors', () => {
    expect(sync.isSkippableOcdsDayError(new Error('OCDS API error 500'))).toBe(true)
    expect(sync.isSkippableOcdsDayError(new Error('OCDS API error 503: gateway'))).toBe(true)
    expect(sync.isSkippableOcdsDayError(new Error('OCDS API error 400: bad'))).toBe(false)
    expect(sync.isSkippableOcdsDayError(new Error('boom'))).toBe(false)
  })

  it('skips unhealthy days and returns releases from healthy days', async () => {
    const pages: string[] = []
    vi.spyOn(sync, 'fetchOcdsPage').mockImplementation(async (...args: unknown[]) => {
      const from = String(args[0] ?? '')
      const to = String(args[1] ?? '')
      pages.push(`${from}:${to}`)
      if (from === '2026-10-01' || from === '2026-10-04') {
        throw new Error('OCDS API error 500')
      }
      return {
        releases: [{ ocid: `ocid-${from}`, tender: { id: from, title: `T ${from}` } }],
        links: {},
      }
    })

    const result = await sync.fetchReleasesInRange('2026-10-01', '2026-10-05', 20)
    expect(result.daysRequested).toBe(5)
    expect(result.daysSucceeded).toBe(3)
    expect(result.dayErrors.map((e: { day: string }) => e.day)).toEqual([
      '2026-10-01',
      '2026-10-04',
    ])
    expect(result.releases).toHaveLength(3)
    // Day-chunked: same from/to per request
    expect(pages.every((p) => p.split(':')[0] === p.split(':')[1])).toBe(true)
  })

  it('fails only when every day in the range is unhealthy', async () => {
    vi.spyOn(sync, 'fetchOcdsPage').mockRejectedValue(new Error('OCDS API error 500'))
    await expect(sync.fetchReleasesInRange('2026-10-01', '2026-10-02', 5)).rejects.toThrow(
      /failed for all 2 day/
    )
  })
})
