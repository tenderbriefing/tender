#!/usr/bin/env node
/**
 * Twilio WhatsApp test — uses env from .env.local (never logs secrets).
 * Usage: npm run test:whatsapp
 * Optional: TEST_WHATSAPP_TO=+27... node scripts/test-whatsapp.js
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const whatsappService = require('../backend/services/whatsappService')

async function main() {
  const config = whatsappService.getConfig()
  const to = process.env.TEST_WHATSAPP_TO || process.env.SMOKE_WHATSAPP_TO

  console.log(
    JSON.stringify(
      {
        configured: config.configured,
        from: config.from,
        missing: config.missing,
        testTo: to ? `${String(to).slice(0, 4)}***` : null,
      },
      null,
      2
    )
  )

  if (!to) {
    console.error('Set TEST_WHATSAPP_TO=+2782... (E.164) to send a test message.')
    process.exit(config.configured ? 1 : 0)
  }

  const validated = whatsappService.validateWhatsAppNumber(to)
  if (!validated.ok) {
    console.error(JSON.stringify({ ok: false, error: validated.error }))
    process.exit(1)
  }

  const result = await whatsappService.sendWhatsAppMessage(
    to,
    'TenderBriefing test: WhatsApp engine is operational.',
    {
      type: 'cli_test',
      recipientRole: 'admin',
      recipientId: 'cli',
      idempotencyKey: `cli_test:${Date.now()}`,
      metadata: { source: 'test-whatsapp.js' },
    }
  )

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        skipped: result.skipped,
        duplicate: result.duplicate,
        sid: result.sid,
        error: result.error,
        status: result.log?.status,
      },
      null,
      2
    )
  )
  process.exit(result.ok || result.skipped ? 0 : 1)
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }))
  process.exit(1)
})
