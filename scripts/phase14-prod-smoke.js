#!/usr/bin/env node
/**
 * Phase 14 production smoke (read-only + public surface checks).
 * Does NOT create real bookings or charge PayFast.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'

async function check(name, fn) {
  try {
    const detail = await fn()
    return { name, ok: true, detail: detail == null ? '' : String(detail).slice(0, 200) }
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message.slice(0, 200) : 'failed',
    }
  }
}

async function main() {
  const checks = []

  checks.push(
    await check('site health', async () => {
      const res = await fetch(`${BASE}/api/health/firestore`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return String(res.status)
    })
  )

  checks.push(
    await check('book-agent page', async () => {
      const res = await fetch(`${BASE}/sme/book-agent`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return String(res.status)
    })
  )

  checks.push(
    await check('admin operations page', async () => {
      const res = await fetch(`${BASE}/admin/operations`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return String(res.status)
    })
  )

  checks.push(
    await check('admin manual payments page', async () => {
      const res = await fetch(`${BASE}/admin/payments/manual`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return String(res.status)
    })
  )

  checks.push(
    await check('fake pay token 404', async () => {
      const res = await fetch(
        `${BASE}/api/pay/not-a-real-phase14-token-abcdefghijklmnopqrstuvwxyz`
      )
      if (res.status !== 404) throw new Error(`expected 404 got ${res.status}`)
      return '404'
    })
  )

  checks.push(
    await check('attendance create requires auth', async () => {
      const res = await fetch(`${BASE}/api/attendance-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenderId: 'x', paymentAmount: 100 }),
      })
      if (res.status !== 401) throw new Error(`expected 401 got ${res.status}`)
      return '401'
    })
  )

  checks.push(
    await check('BRIEFING_PRICE_CENTS source is 75000', async () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.join(process.cwd(), 'backend/constants/briefingPricing.js'),
        'utf8'
      )
      if (!src.includes('BRIEFING_PRICE_CENTS = 75000')) {
        throw new Error('canonical price constant missing 75000')
      }
      return '75000'
    })
  )

  checks.push(
    await check('R75 cert gate is founder-only module', async () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.join(process.cwd(), 'backend/services/payments/payfastLiveCertificationService.js'),
        'utf8'
      )
      if (!src.includes('LIVE_CERTIFICATION_AMOUNT_CENTS')) {
        throw new Error('R75 cert service missing')
      }
      if (!src.includes('opsConfig') || !src.includes('payfastLiveCertification')) {
        throw new Error('R75 gate doc missing')
      }
      return 'founder-gated'
    })
  )

  const failed = checks.filter((c) => !c.ok)
  const report = {
    phase: 14,
    base: BASE,
    passed: failed.length === 0,
    checks,
    blockers: failed.map((c) => `${c.name}: ${c.detail}`),
    note:
      'Live R75 PayFast charge requires Founder approval + card/3DS — not executed by this smoke.',
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
