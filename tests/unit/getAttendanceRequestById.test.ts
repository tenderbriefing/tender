import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const requestsFile = path.join(__dirname, '../../backend/data/attendance-requests.json')

describe('getAttendanceRequestById', () => {
  let backup: string | null = null

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    if (fs.existsSync(requestsFile)) backup = fs.readFileSync(requestsFile, 'utf8')
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')
    for (const k of Object.keys(require.cache).filter(
      (key) =>
        key.includes('storageAdapter') ||
        key.includes('agentAssignmentService') ||
        key.includes('attendancePaymentService')
    )) {
      delete require.cache[k]
    }
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it('loads one attendance request by document id without listing the collection for lookup', async () => {
    const { getStorage } = require('../../backend/services/storageAdapter')
    const storage = getStorage()
    const created = await storage.saveAttendanceRequest({
      id: 'req-direct-1',
      smeId: 'sme-a',
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
    })
    const found = await storage.getAttendanceRequestById(created.id)
    expect(found?.id).toBe('req-direct-1')
    expect(found?.smeId).toBe('sme-a')
    expect(await storage.getAttendanceRequestById('missing-id')).toBeNull()

    const agentService = require('../../backend/services/agentAssignmentService')
    const viaAssignment = await agentService.getRequestById('req-direct-1')
    expect(viaAssignment?.id).toBe('req-direct-1')
    expect(await agentService.getRequestById('missing-id')).toBeNull()
  })

  it('assignment and payment getRequestById use the direct lookup', async () => {
    const agentService = require('../../backend/services/agentAssignmentService')
    const paymentService = require('../../backend/services/payments/attendancePaymentService')
    const srcAgent = fs.readFileSync(
      path.join(__dirname, '../../backend/services/agentAssignmentService.js'),
      'utf8'
    )
    const srcPay = fs.readFileSync(
      path.join(__dirname, '../../backend/services/payments/attendancePaymentService.js'),
      'utf8'
    )
    const getRequestFn = srcAgent.slice(
      srcAgent.indexOf('async function getRequestById'),
      srcAgent.indexOf('async function createRequest')
    )
    expect(getRequestFn).toMatch(/getAttendanceRequestById/)
    expect(getRequestFn).not.toMatch(/getAttendanceRequests\(/)
    const payFn = srcPay.slice(
      srcPay.indexOf('async function getRequestById'),
      srcPay.indexOf('async function saveRequest')
    )
    expect(payFn).toMatch(/getAttendanceRequestById/)
    expect(payFn).not.toMatch(/getAttendanceRequests\(/)
    expect(typeof agentService.getRequestById).toBe('function')
    expect(typeof paymentService.markRequestPaid).toBe('function')
  })
})
