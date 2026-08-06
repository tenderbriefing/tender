const DEFAULT_REQUEST_TIMEOUT_MS = 300_000
const DEFAULT_SAFETY_MARGIN_MS = 20_000
const DEFAULT_EXECUTION_BUDGET_MS = 240_000

function parsePositiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

function readExecutionBudgetConfig(env = process.env) {
  const requestTimeoutMs = parsePositiveInteger(
    env.AUTOMATION_REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
    { min: 30_000, max: 3_600_000 }
  )
  const safetyMarginMs = parsePositiveInteger(
    env.AUTOMATION_SAFETY_MARGIN_MS,
    DEFAULT_SAFETY_MARGIN_MS,
    { min: 1_000, max: Math.max(1_000, requestTimeoutMs - 1_000) }
  )
  const maximumBudgetMs = requestTimeoutMs - safetyMarginMs
  const requestedBudgetMs = parsePositiveInteger(
    env.AUTOMATION_BUDGET_MS,
    DEFAULT_EXECUTION_BUDGET_MS,
    { min: 1_000, max: maximumBudgetMs }
  )
  const budgetMs = Math.min(requestedBudgetMs, maximumBudgetMs)
  return { requestTimeoutMs, safetyMarginMs, budgetMs }
}

function createExecutionBudget(options = {}) {
  const clock = typeof options.now === 'function' ? options.now : Date.now
  const config = options.config || readExecutionBudgetConfig(options.env)
  const startedAtMs = clock()
  const deadlineMs = startedAtMs + config.budgetMs

  return {
    ...config,
    startedAtMs,
    deadlineMs,
    now: clock,
    elapsedMs: () => Math.max(0, clock() - startedAtMs),
    remainingMs: () => Math.max(0, deadlineMs - clock()),
    canStart: (minimumStartMs = 0) => deadlineMs - clock() >= minimumStartMs,
    expired: () => clock() >= deadlineMs,
    metadata: () => ({
      startedAt: new Date(startedAtMs).toISOString(),
      deadlineAt: new Date(deadlineMs).toISOString(),
      budgetMs: config.budgetMs,
      safetyMarginMs: config.safetyMarginMs,
      requestTimeoutMs: config.requestTimeoutMs,
    }),
  }
}

module.exports = {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SAFETY_MARGIN_MS,
  DEFAULT_EXECUTION_BUDGET_MS,
  parsePositiveInteger,
  readExecutionBudgetConfig,
  createExecutionBudget,
}
