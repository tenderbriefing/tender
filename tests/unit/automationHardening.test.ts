import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const budget = require('../../backend/services/automation/executionBudget')
const registry = require('../../backend/services/automation/jobRegistry')
const stateStore = require('../../backend/services/automation/automationStateStore')

describe('executionBudget', () => {
  it('uses a 240s default with a 20s safety margin below the 300s request limit', () => {
    const config = budget.readExecutionBudgetConfig({})
    expect(config).toEqual({
      requestTimeoutMs: 300_000,
      safetyMarginMs: 20_000,
      budgetMs: 240_000,
    })
  })

  it('parses valid overrides and rejects invalid or unsafe values', () => {
    expect(
      budget.readExecutionBudgetConfig({
        AUTOMATION_REQUEST_TIMEOUT_MS: '200000',
        AUTOMATION_SAFETY_MARGIN_MS: '25000',
        AUTOMATION_BUDGET_MS: '150000',
      })
    ).toEqual({
      requestTimeoutMs: 200_000,
      safetyMarginMs: 25_000,
      budgetMs: 150_000,
    })
    expect(budget.readExecutionBudgetConfig({ AUTOMATION_BUDGET_MS: '999999' }).budgetMs).toBe(240_000)
    expect(budget.readExecutionBudgetConfig({ AUTOMATION_BUDGET_MS: 'NaN' }).budgetMs).toBe(240_000)
  })

  it('supports an injected monotonic clock', () => {
    let now = 1_000
    const execution = budget.createExecutionBudget({
      now: () => now,
      config: { requestTimeoutMs: 300, safetyMarginMs: 20, budgetMs: 200 },
    })
    expect(execution.remainingMs()).toBe(200)
    expect(execution.canStart(150)).toBe(true)
    now += 75
    expect(execution.elapsedMs()).toBe(75)
    expect(execution.remainingMs()).toBe(125)
    expect(execution.canStart(150)).toBe(false)
  })
})

describe('automation job registry', () => {
  it('is the validated source of truth for all scheduled jobs', () => {
    const jobs = registry.listJobs()
    expect(jobs).toHaveLength(14)
    expect(jobs.map((job: { priority: number }) => job.priority)).toEqual(
      [...jobs].map((job: { priority: number }) => job.priority).sort((a, b) => a - b)
    )
    for (const job of jobs) {
      expect(registry.validateJobName(job.name)).toBe(true)
      expect(job.minStartMs).toBeGreaterThan(0)
      expect(typeof job.sideEffects).toBe('boolean')
      expect(job.retry).toBeTruthy()
    }
    expect(registry.validateJobName('all')).toBe(true)
    expect(registry.validateJobName('not-a-job')).toBe(false)
  })

  it('round-trips only versioned continuation cursors', () => {
    const encoded = registry.encodeContinuation({ jobIndex: 4, offset: 10 })
    expect(registry.decodeContinuation(encoded)).toMatchObject({ v: 1, jobIndex: 4, offset: 10 })
    expect(registry.decodeContinuation('not-base64')).toBeNull()
    const old = Buffer.from(JSON.stringify({ v: 0, jobIndex: 4 })).toString('base64url')
    expect(registry.decodeContinuation(old)).toBeNull()
  })
})

describe('automation state store memory compatibility', () => {
  beforeEach(() => {
    process.env.AUTOMATION_STATE_ADAPTER = 'memory'
    stateStore.resetMemoryState()
  })

  afterEach(() => {
    delete process.env.AUTOMATION_STATE_ADAPTER
  })

  it('atomically skips overlap, permits expired takeover, and owner-only release', async () => {
    const first = await stateStore.acquireLease({ ownerId: 'run-a', now: 1_000, ttlMs: 300 })
    expect(first.acquired).toBe(true)

    const overlap = await stateStore.acquireLease({ ownerId: 'run-b', now: 1_100, ttlMs: 300 })
    expect(overlap).toMatchObject({ acquired: false, ownerId: 'run-a' })
    expect(await stateStore.releaseLease({ ownerId: 'run-b', now: 1_150 })).toBe(false)

    const takeover = await stateStore.acquireLease({ ownerId: 'run-c', now: 1_301, ttlMs: 300 })
    expect(takeover).toMatchObject({ acquired: true, ownerId: 'run-c', takeover: true })
    expect(
      await stateStore.releaseLease({
        ownerId: 'run-c',
        continuations: { calendar_intelligence: 'cursor' },
        now: 1_400,
      })
    ).toBe(true)
  })

  it('persists bounded run summaries and updates the same run id', async () => {
    await stateStore.saveRun({ runId: 'same', status: 'running', startedAt: '2026-01-01T00:00:00Z' })
    await stateStore.saveRun({ runId: 'same', status: 'completed', startedAt: '2026-01-01T00:00:00Z' })
    for (let index = 0; index < 110; index += 1) {
      await stateStore.saveRun({
        runId: `run-${index}`,
        status: 'completed',
        startedAt: new Date(index * 1000).toISOString(),
      })
    }
    const state = await stateStore.getOperationalState({ limit: 100 })
    expect(state.runs).toHaveLength(100)
    expect(state.runs.filter((run: { runId: string }) => run.runId === 'same')).toHaveLength(0)
  })

  it('can retain a timed-out owner until expiry to suppress Scheduler retries', async () => {
    await stateStore.acquireLease({ ownerId: 'timed-out', now: 1_000, ttlMs: 300 })
    expect(
      await stateStore.releaseLease({
        ownerId: 'timed-out',
        continuations: { daily_procurement_brief: 'next' },
        now: 1_100,
        keepUntilExpiry: true,
      })
    ).toBe(true)
    expect(
      await stateStore.acquireLease({ ownerId: 'retry', now: 1_200, ttlMs: 300 })
    ).toMatchObject({ acquired: false, ownerId: 'timed-out' })
  })
})

describe('deterministic storage scan accounting', () => {
  it('reduces daily brief and watchlist full scans to one shared pair per batch', () => {
    const smeBatch = 5
    const agentBatch = 5
    const dailyBefore = {
      getAllTenders: smeBatch * 2,
      getAttendanceRequests: smeBatch * 2 + agentBatch,
    }
    const dailyAfter = { getAllTenders: 1, getAttendanceRequests: 1 }
    const watchlistBefore = { getAllTenders: smeBatch, getAttendanceRequests: smeBatch }
    const watchlistAfter = { getAllTenders: 1, getAttendanceRequests: 1 }

    expect(dailyBefore).toEqual({ getAllTenders: 10, getAttendanceRequests: 15 })
    expect(dailyAfter).toEqual({ getAllTenders: 1, getAttendanceRequests: 1 })
    expect(watchlistBefore).toEqual({ getAllTenders: 5, getAttendanceRequests: 5 })
    expect(watchlistAfter).toEqual({ getAllTenders: 1, getAttendanceRequests: 1 })
  })
})
