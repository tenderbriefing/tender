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

const matching = read('app/api/matching/route.ts')
assert.match(matching, /410/, 'matching route must return 410')
assert.match(matching, /LEGACY_MATCHING_DISABLED/, 'matching must expose retirement code')

const connector = read('app/api/connector-response/route.ts')
assert.match(connector, /410/, 'connector-response route must return 410')
assert.match(
  connector,
  /LEGACY_CONNECTOR_RESPONSE_DISABLED/,
  'connector-response must expose retirement code'
)

const yocoCreate = read('app/api/payments/yoco/create-checkout/route.ts')
assert.match(yocoCreate, /410/, 'yoco create-checkout must return 410')

const yocoConfirm = read('app/api/payments/yoco/confirm/route.ts')
assert.match(yocoConfirm, /410/, 'yoco confirm must return 410')

const pushSend = read('app/api/push-notifications/send/route.ts')
assert.match(pushSend, /410/, 'push send must return 410')
assert.match(pushSend, /PUSH_NOTIFICATIONS_RETIRED/, 'push send must expose retirement code')

const pushSubscribe = read('app/api/push-notifications/subscribe/route.ts')
assert.match(pushSubscribe, /410/, 'push subscribe must return 410')

const pushRegister = read('app/api/push/register-token/route.ts')
assert.match(pushRegister, /410/, 'push register-token must return 410')

assert.ok(
  !fs.existsSync(path.join(root, 'hooks/usePushNotifications.ts')),
  'usePushNotifications hook must be removed'
)
assert.ok(
  !fs.existsSync(path.join(root, 'backend/services/pushNotificationService.js')),
  'pushNotificationService must be removed'
)
assert.ok(
  !fs.existsSync(path.join(root, 'backend/services/integrations/fcmService.js')),
  'fcmService must be removed'
)

const mobileBootstrap = read('app/agent/mobile/MobileFieldBootstrap.tsx')
assert.doesNotMatch(
  mobileBootstrap,
  /Notification\.requestPermission|usePushNotifications/,
  'MobileFieldBootstrap must not request push permission'
)

assert.ok(
  fs.existsSync(path.join(root, '_legacy/services/bookingService.ts')),
  'legacy bookingService must be quarantined under _legacy/'
)
assert.ok(
  fs.existsSync(path.join(root, '_legacy/services/yocoService.js')),
  'legacy yocoService must be quarantined under _legacy/'
)

const policy = read('lib/security/apiRoutePolicy.ts')
assert.match(policy, /\/api\/bookings/, 'apiRoutePolicy must block bookings in production')
assert.match(policy, /\/api\/matching/, 'apiRoutePolicy must block matching in production')
assert.match(
  policy,
  /\/api\/connector-response/,
  'apiRoutePolicy must block connector-response in production'
)
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
assert.match(
  read('backend/services/liveDispatchService.js'),
  /lifecycleEnforcement/,
  'liveDispatchService must use lifecycle enforcement for auto-assign'
)
assert.match(
  read('backend/services/payments/attendancePaymentService.js'),
  /assertPaymentTransition/,
  'attendancePaymentService must assert payment transitions'
)

console.log('route-retirement-qa: all checks passed')
