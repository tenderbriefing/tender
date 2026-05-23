#!/usr/bin/env node
/**
 * Local integration health check (no secrets printed).
 * Usage: node scripts/test-integrations-health.js
 * Optional: BASE_URL=https://localhost:3000 node scripts/test-integrations-health.js
 */

const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

async function main() {
  const url = `${baseUrl}/api/integrations/health`
  console.log(`GET ${url}\n`)

  const response = await fetch(url)
  const body = await response.json()

  if (!response.ok) {
    console.error('HTTP', response.status, body)
    process.exit(1)
  }

  console.log('Summary:', body.summary)
  console.log('Checked at:', body.checkedAt)
  console.log('\nIntegrations:')
  for (const item of body.integrations || []) {
    console.log(`  - ${item.name}: ${item.status}`)
    if (item.missing?.length) {
      console.log(`      missing: ${item.missing.join(', ')}`)
    }
  }

  const hasUnexpectedErrors = (body.integrations || []).some(
    (i) => i.status === 'error'
  )
  if (hasUnexpectedErrors) {
    console.warn('\nWarning: one or more integrations reported error status.')
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
