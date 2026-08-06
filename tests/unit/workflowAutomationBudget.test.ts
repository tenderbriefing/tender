import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const workflow = require('../../backend/services/workflowAutomationService')
const stateStore = require('../../backend/services/automation/automationStateStore')

const {
  SCHEDULED_JOBS,
  DEFAULT_AUTOMATION_BUDGET_MS,
  STALE_RUN_LOCK_MS,
  automationBudgetMs,
  rotateJobs,
  isStaleRunLock,
  buildTrackedTenderIndex,
  runScheduledAutomation,
} = workflow

/** Deterministic clock the sweep can read while injected jobs "spend" time. */
function fakeClock(startMs = 1_700_000_000_000) {
  let current = startMs
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
  }
}

function trackedDoc(smeId: string | undefined, data: Record<string, unknown>) {
  return {
    data: () => data,
    ref: { parent: { parent: smeId ? { id: smeId } : null } },
  }
}

describe('automation run budget', () => {
  beforeEach(() => {
    process.env.AUTOMATION_STATE_ADAPTER = 'memory'
    stateStore.resetMemoryState()
  })

  afterEach(() => {
    delete process.env.AUTOMATION_BUDGET_MS
    delete process.env.AUTOMATION_STATE_ADAPTER
  })

  it('defaults to a budget below the 300s Cloud Run request timeout', () => {
    expect(DEFAULT_AUTOMATION_BUDGET_MS).toBeLessThan(300 * 1000)
    expect(automationBudgetMs()).toBe(DEFAULT_AUTOMATION_BUDGET_MS)
  })

  it('honours a positive AUTOMATION_BUDGET_MS override and ignores junk values', () => {
    process.env.AUTOMATION_BUDGET_MS = '90000'
    expect(automationBudgetMs()).toBe(90000)
    process.env.AUTOMATION_BUDGET_MS = 'not-a-number'
    expect(automationBudgetMs()).toBe(DEFAULT_AUTOMATION_BUDGET_MS)
    process.env.AUTOMATION_BUDGET_MS = '-1'
    expect(automationBudgetMs()).toBe(DEFAULT_AUTOMATION_BUDGET_MS)
  })

  it('rotates the job list from the stored cursor and wraps around', () => {
    expect(rotateJobs(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c'])
    expect(rotateJobs(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a'])
    expect(rotateJobs(['a', 'b', 'c'], 4)).toEqual(['b', 'c', 'a'])
    expect(rotateJobs(['a', 'b', 'c'], -1)).toEqual(['c', 'a', 'b'])
    expect(rotateJobs(['a', 'b', 'c'], NaN)).toEqual(['a', 'b', 'c'])
    expect(rotateJobs([], 3)).toEqual([])
  })

  it('completes every job and keeps the cursor when the sweep fits the budget', async () => {
    const clock = fakeClock()
    const ran: string[] = []
    const result = await runScheduledAutomation('all', {
      lock: false,
      now: clock.now,
      budgetMs: 240_000,
      minJobSliceMs: 1_000,
      runJob: async (job: string) => {
        ran.push(job)
        clock.advance(1_000)
        return { job, triggered: 0 }
      },
    })

    expect(result.status).toBe('completed')
    expect(ran).toEqual(SCHEDULED_JOBS)
    expect(result.deferredJobs).toEqual([])
    expect(result.timedOutJobs).toEqual([])
    expect(result.nextCursor).toBe(result.cursor)
    expect(result.durationMs).toBeLessThan(240_000)
  })

  it('stops at the budget and defers the remaining jobs instead of running past it', async () => {
    const clock = fakeClock()
    const ran: string[] = []
    const result = await runScheduledAutomation('all', {
      lock: false,
      now: clock.now,
      budgetMs: 100_000,
      minJobSliceMs: 1_000,
      runJob: async (job: string) => {
        ran.push(job)
        clock.advance(30_000)
        return { job }
      },
    })

    expect(result.status).toBe('partial')
    expect(ran).toEqual(SCHEDULED_JOBS.slice(0, 4))
    expect(result.completedJobs).toEqual(SCHEDULED_JOBS.slice(0, 4))
    expect(result.deferredJobs).toEqual(SCHEDULED_JOBS.slice(4))
  })

  it('returns within its wall-clock budget when jobs really do hang', async () => {
    const budgetMs = 400
    const startedAt = Date.now()
    const result = await runScheduledAutomation('all', {
      lock: false,
      budgetMs,
      minJobSliceMs: 50,
      runJob: () => new Promise(() => {}),
    })
    const elapsed = Date.now() - startedAt

    expect(elapsed).toBeLessThan(budgetMs * 2)
    expect(result.status).toBe('partial')
    expect(result.timedOutJobs).toEqual([SCHEDULED_JOBS[0]])
  })

  it('resumes at the deferred job on the next run so nothing starves', async () => {
    const clock = fakeClock()
    const firstRan: string[] = []
    const first = await runScheduledAutomation('all', {
      lock: false,
      now: clock.now,
      budgetMs: 100_000,
      minJobSliceMs: 1_000,
      runJob: async (job: string) => {
        firstRan.push(job)
        clock.advance(30_000)
        return { job }
      },
    })

    const secondClock = fakeClock()
    const secondRan: string[] = []
    await runScheduledAutomation('all', {
      lock: false,
      now: secondClock.now,
      cursor: first.nextCursor,
      budgetMs: 100_000,
      minJobSliceMs: 1_000,
      runJob: async (job: string) => {
        secondRan.push(job)
        secondClock.advance(30_000)
        return { job }
      },
    })

    expect(first.nextCursor).toBe(4)
    expect(secondRan[0]).toBe(SCHEDULED_JOBS[4])
    expect(firstRan).not.toContain(secondRan[0])
  })

  it('aborts a job that outlives its slice and moves past it next run', async () => {
    const clock = fakeClock()
    const result = await runScheduledAutomation('all', {
      lock: false,
      now: clock.now,
      budgetMs: 50,
      minJobSliceMs: 1,
      runJob: (job: string) =>
        job === SCHEDULED_JOBS[0] ? new Promise(() => {}) : Promise.resolve({ job }),
    })

    expect(result.status).toBe('partial')
    expect(result.timedOutJobs).toEqual([SCHEDULED_JOBS[0]])
    expect(result.jobs[SCHEDULED_JOBS[0]].timedOut).toBe(true)
    expect(result.deferredJobs).toEqual(SCHEDULED_JOBS.slice(1))
    expect(result.nextCursor).toBe(1)
  })

  it('records a failing job and keeps sweeping the rest', async () => {
    const clock = fakeClock()
    const result = await runScheduledAutomation('all', {
      lock: false,
      now: clock.now,
      budgetMs: 240_000,
      minJobSliceMs: 1_000,
      runJob: async (job: string) => {
        clock.advance(1_000)
        if (job === SCHEDULED_JOBS[2]) throw new Error('boom')
        return { job }
      },
    })

    expect(result.status).toBe('completed')
    expect(result.jobs[SCHEDULED_JOBS[2]].error).toBe('boom')
    expect(Object.keys(result.jobs)).toHaveLength(SCHEDULED_JOBS.length)
  })

  it('runs a single named job without rotation or budget bookkeeping', async () => {
    const ran: string[] = []
    const result = await runScheduledAutomation('retry_failed_whatsapp', {
      runJob: async (job: string) => {
        ran.push(job)
        return { job, retried: 0 }
      },
    })

    expect(ran).toEqual(['retry_failed_whatsapp'])
    expect(result.status).toBe('completed')
    expect(result.completedJobs).toEqual(['retry_failed_whatsapp'])
  })
})

describe('automation run lock', () => {
  it('treats a lock older than the Cloud Run ceiling as abandoned', () => {
    const now = Date.now()
    expect(isStaleRunLock({ isRunning: false }, now)).toBe(false)
    expect(
      isStaleRunLock({ isRunning: true, runStartedAt: new Date(now - 1000).toISOString() }, now)
    ).toBe(false)
    expect(
      isStaleRunLock(
        { isRunning: true, runStartedAt: new Date(now - STALE_RUN_LOCK_MS - 1000).toISOString() },
        now
      )
    ).toBe(true)
    expect(isStaleRunLock({ isRunning: true }, now)).toBe(true)
  })
})

describe('tracked tender index', () => {
  it('indexes tracked tenders by both id fields for one collection-group read', () => {
    const index = buildTrackedTenderIndex([
      trackedDoc('sme-1', { tenderId: 'T-1' }),
      trackedDoc('sme-2', { id: 'T-1' }),
      trackedDoc('sme-3', { tenderId: 'T-2' }),
      trackedDoc(undefined, { tenderId: 'T-1' }),
    ])

    expect(index.get('T-1')).toEqual(['sme-1', 'sme-2'])
    expect(index.get('T-2')).toEqual(['sme-3'])
    expect(index.get('T-3')).toBeUndefined()
  })

  it('does not double-count an entry whose id fields both match', () => {
    const index = buildTrackedTenderIndex([trackedDoc('sme-1', { tenderId: 'T-1', id: 'T-1' })])
    expect(index.get('T-1')).toEqual(['sme-1'])
  })
})
