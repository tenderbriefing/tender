import { resolveAttendanceFeeCents } from '@/lib/domain/paymentLifecycle'

/**
 * Typed runtime configuration — fail closed in production when required values missing.
 * Client-safe values must use NEXT_PUBLIC_* and never import server secrets.
 */

export type AppEnvironment = 'development' | 'test' | 'production' | 'preview'

export interface ServerRuntimeConfig {
  env: AppEnvironment
  siteUrl: string
  firebaseProjectId: string
  payfast: {
    merchantId: string | null
    configured: boolean
    sandbox: boolean
  }
  attendanceFeeCents: number
  whatsappWebhookEnabled: boolean
}

function detectEnv(): AppEnvironment {
  if (process.env.NODE_ENV === 'test') return 'test'
  if (process.env.VERCEL_ENV === 'preview' || process.env.FIREBASE_APP_HOSTING_PREVIEW) {
    return 'preview'
  }
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

export function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.tenderbriefing.co.za'
  return String(url).replace(/\/$/, '')
}

export function requireEnv(name: string, value: string | undefined | null): string {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return String(value).trim()
}

export function getServerRuntimeConfig(): ServerRuntimeConfig {
  const env = detectEnv()
  const merchantId = process.env.PAYFAST_MERCHANT_ID?.trim() || null
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY?.trim() || null
  const configured = Boolean(merchantId && merchantKey)

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    ''

  if (env === 'production' && !projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID (or GCLOUD_PROJECT) required in production')
  }

  return {
    env,
    siteUrl: getSiteUrl(),
    firebaseProjectId: projectId || (env === 'production' ? '' : 'tenderbriefing-34679'),
    payfast: {
      merchantId,
      configured,
      sandbox: String(process.env.PAYFAST_SANDBOX || '').toLowerCase() === 'true',
    },
    attendanceFeeCents: resolveAttendanceFeeCents(),
    whatsappWebhookEnabled:
      String(process.env.WHATSAPP_WEBHOOK_ENABLED || '').toLowerCase() === 'true' &&
      Boolean(process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_APP_SECRET),
  }
}

/** Validate production boot essentials without throwing in import graphs during build. */
export function validateProductionConfigSoft(): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (process.env.NODE_ENV !== 'production') return { ok: true, errors }
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    errors.push('NEXT_PUBLIC_FIREBASE_API_KEY missing')
  }
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID missing')
  }
  if (!process.env.PAYFAST_MERCHANT_ID || !process.env.PAYFAST_MERCHANT_KEY) {
    errors.push('PayFast merchant credentials missing')
  }
  return { ok: errors.length === 0, errors }
}
