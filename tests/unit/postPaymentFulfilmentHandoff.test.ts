/**
 * Paid R349 requests must enter YA fulfilment without waiting for cron.
 */
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('post-payment YA fulfilment handoff', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'backend/services/payments/attendancePaymentService.js'),
    'utf8'
  )

  it('markRequestPaid invokes notifyAgentsAfterPayment after confirmation emails', () => {
    const paidFnStart = src.indexOf('async function markRequestPaid')
    const paidFnEnd = src.indexOf('async function markRequestFailed')
    const paidBody = src.slice(paidFnStart, paidFnEnd)
    expect(paidBody).toContain('notifyAgentsAfterPayment')
    expect(paidBody.indexOf('notifyAgentsAfterPayment')).toBeGreaterThan(
      paidBody.indexOf('sendAttendancePaymentConfirmationSafe')
    )
  })

  it('notifyAgentsAfterPayment uses liveDispatch autoDispatch for unpaid-agent requests', () => {
    const fnStart = src.indexOf('async function notifyAgentsAfterPayment')
    const fnEnd = src.indexOf('async function markRequestPaid')
    const body = src.slice(fnStart, fnEnd)
    expect(body).toContain('liveDispatchService')
    expect(body).toContain('autoDispatchRequest')
    expect(body).toContain('post_payment_initial')
    expect(body).toContain('alreadyDispatched')
  })

  it('failed payment path does not dispatch agents', () => {
    const failedFn = src.slice(src.indexOf('async function markRequestFailed'))
    const failedBody = failedFn.slice(0, failedFn.indexOf('async function markRequestCancelled'))
    expect(failedBody).not.toContain('notifyAgentsAfterPayment')
    expect(failedBody).not.toContain('autoDispatchRequest')
  })
})
