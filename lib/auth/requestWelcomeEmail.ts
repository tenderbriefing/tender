'use client'

import { authFetch } from '@/lib/api/authenticatedFetch'

/**
 * Request a one-time welcome email after successful registration.
 * Never throws — failures are logged and ignored so signup UX stays clean.
 */
export async function requestWelcomeEmail(): Promise<void> {
  try {
    const res = await authFetch('/api/auth/welcome-email', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      console.warn('[welcomeEmail] request returned', res.status)
    }
  } catch (err) {
    console.warn('[welcomeEmail] request failed (non-blocking):', err)
  }
}
