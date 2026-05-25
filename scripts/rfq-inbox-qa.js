#!/usr/bin/env node
/**
 * Phase 19 — RFQ inbox QA (no secrets in output).
 */
const fs = require('fs')
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const report = { checks: [], passed: false, blockers: [] }

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

async function main() {
  const required = [
    'backend/services/procurement/emailIngestionService.js',
    'app/api/procurement/email-ingestion/route.ts',
    'app/api/procurement/email-ingestion/[id]/convert/route.ts',
    'app/admin/procurement-inbox/page.tsx',
    'app/sme/rfq-inbox/page.tsx',
  ]
  for (const f of required) check(`file ${f}`, fs.existsSync(path.join(process.cwd(), f)))

  const rules = fs.readFileSync('firestore.rules', 'utf8')
  check('ingestedProcurementEmails SME read', rules.includes('match /ingestedProcurementEmails/'))
  check('private tenderBriefings rule', rules.includes("visibility != 'private'"))

  const emailIngestion = require('../backend/services/procurement/emailIngestionService')

  const sample = await emailIngestion.ingestEmail({
    subject: 'RFQ QA — Compulsory briefing session',
    rawEmailText: `Reference: QA-RFQ-19
Department: QA Municipality Gauteng
Compulsory briefing on 2026-08-15 at 10:00
Venue: 100 Main Road, Johannesburg
Closing date 2026-08-20
Contact: ops-smoke-sme@tenderbriefing.co.za`,
    fromEmail: 'qa-sme@test.local',
    forwardedByUid: 'qa-sme-uid-phase19',
    source: 'manual_upload',
  })
  check('raw email ingestion', Boolean(sample.id))
  check('AI extraction title', Boolean(sample.extraction?.title))
  check('readiness score', Boolean(sample.extraction?.readiness))
  check('briefing detected', sample.extraction?.readiness?.briefingDetected === true)

  const approved = await emailIngestion.updateStatus(sample.id, 'approved', { approvedBy: 'qa' })
  check('approve flow', approved.status === 'approved')

  const converted = await emailIngestion.convertToPrivateOpportunity(sample.id, {
    ownerUid: 'qa-sme-uid-phase19',
    approvedBy: 'qa',
  })
  check('private opportunity conversion', Boolean(converted.tender?.id))
  check('private visibility', converted.tender.visibility === 'private')
  check('ownerUid set', converted.tender.ownerUid === 'qa-sme-uid-phase19')
  check('source private_email', converted.tender.source === 'private_email')
  check('dispatchEligible field', converted.tender.dispatchEligible !== false)
  check('originalEmailId link', converted.tender.originalEmailId === sample.id)

  const dup = require('../backend/services/procurement/deduplicationService')
  const dupCheck = dup.isCrossSourceDuplicate(
    { tenderNumber: 'QA-RFQ-19', title: converted.tender.title, source: 'etenders' },
    converted.tender
  )
  check('duplicate detection runs', typeof dupCheck.duplicate === 'boolean')

  const out = JSON.stringify({ sample: { id: sample.id, status: sample.status }, converted })
  check('no secrets in output', !/sk-[a-zA-Z0-9]{20,}/.test(out))

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  check('npm script rfq-inbox:qa', Boolean(pkg.scripts['rfq-inbox:qa']))

  report.passed = report.blockers.length === 0
  report.operationalReadiness = report.passed ? 'ready' : 'blocked'
  report.sampleEmailId = sample.id
  report.convertedTenderId = converted.tender?.id
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
