#!/usr/bin/env node
/**
 * Route retirement QA — legacy booking/Yoco must not succeed.
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8')
}

const bookings = read('app/api/bookings/route.ts')
assert.match(bookings, /410/, 'bookings route must return 410')

const yocoCreate = read('app/api/payments/yoco/create-checkout/route.ts')
assert.match(yocoCreate, /410/, 'yoco create-checkout must return 410')

const yocoConfirm = read('app/api/payments/yoco/confirm/route.ts')
assert.match(yocoConfirm, /410/, 'yoco confirm must return 410')

const policy = read('lib/security/apiRoutePolicy.ts')
assert.match(policy, /\/api\/bookings/, 'apiRoutePolicy must block bookings in production')

const lifecycle = read('backend/services/domain/lifecycleEnforcement.js')
assert.match(lifecycle, /assertWorkflowTransition/, 'lifecycle enforcement module must exist')
assert.match(
  read('backend/services/agentAssignmentService.js'),
  /lifecycleEnforcement/,
  'agentAssignmentService must use lifecycle enforcement'
)
assert.match(
  read('backend/services/payments/attendancePaymentService.js'),
  /lifecycleEnforcement/,
  'attendancePaymentService must use lifecycle enforcement'
)

console.log('route-retirement-qa: all checks passed')
