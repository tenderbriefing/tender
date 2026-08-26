import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

const root = path.join(__dirname, '../..')

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('push notification retirement', () => {
  it('retired routes return 410 with PUSH_NOTIFICATIONS_RETIRED', () => {
    for (const route of [
      'app/api/push-notifications/send/route.ts',
      'app/api/push-notifications/subscribe/route.ts',
      'app/api/push/register-token/route.ts',
    ]) {
      const src = read(route)
      expect(src).toMatch(/410/)
      expect(src).toMatch(/PUSH_NOTIFICATIONS_RETIRED/)
    }
  })

  it('removes dead push client and backend services', () => {
    expect(fs.existsSync(path.join(root, 'hooks/usePushNotifications.ts'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'lib/services/pushNotificationService.ts'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'backend/services/pushNotificationService.js'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'backend/services/integrations/fcmService.js'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'mobile-agent-app/src/services/push.ts'))).toBe(false)
  })

  it('notificationService active channels exclude push', () => {
    const src = read('backend/services/notificationService.js')
    expect(src).toMatch(/const CHANNELS = \['email', 'whatsapp'\]/)
    expect(src).not.toMatch(/dispatch\('push'/)
  })

  it('workflow automation default channels exclude push', () => {
    const src = read('backend/services/workflowAutomationService.js')
    expect(src).not.toMatch(/pushNotificationService/)
    expect(src).not.toMatch(/'push'/)
    expect(src).not.toMatch(/"push"/)
  })

  it('MobileFieldBootstrap does not request browser notification permission', () => {
    const src = read('app/agent/mobile/MobileFieldBootstrap.tsx')
    expect(src).not.toMatch(/usePushNotifications/)
    expect(src).not.toMatch(/Notification\.requestPermission/)
  })
})
