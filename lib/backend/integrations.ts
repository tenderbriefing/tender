/* eslint-disable @typescript-eslint/no-require-imports */

export type IntegrationStatus = 'configured' | 'missing' | 'error'

export interface IntegrationHealthItem {
  id: string
  name: string
  status: IntegrationStatus
  requiredEnv: string[]
  missing: string[]
  setupNotes: string
  message?: string
  lastChecked: string
}

export interface IntegrationsHealthResponse {
  ok: boolean
  checkedAt: string
  summary: {
    total: number
    configured: number
    missing: number
    error: number
  }
  integrations: IntegrationHealthItem[]
}

export function getIntegrationsHealth(): Promise<IntegrationsHealthResponse> {
  const service = require('../../backend/services/integrationHealthService.js')
  return service.getIntegrationsHealth()
}

export function loadIntegrationService<T = Record<string, unknown>>(
  name: string
): T {
  const services: Record<string, string> = {
    whatsapp: '../../backend/services/integrations/whatsappService.js',
    firebaseStorage: '../../backend/services/integrations/firebaseStorageService.js',
    maps: '../../backend/services/integrations/mapsService.js',
    fcm: '../../backend/services/integrations/fcmService.js',
    yoco: '../../backend/services/integrations/yocoService.js',
    openai: '../../backend/services/integrations/openaiService.js',
    analytics: '../../backend/services/integrations/analyticsService.js',
    googleCalendar: '../../backend/services/integrations/calendarService.js',
    microsoftGraph: '../../backend/services/integrations/microsoftGraphService.js',
  }
  const path = services[name]
  if (!path) throw new Error(`Unknown integration service: ${name}`)
  return require(path) as T
}
