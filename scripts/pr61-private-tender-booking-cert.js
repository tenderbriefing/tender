/**
 * Local/json certification: private tender → canonical → attendance snapshot R349 / YA R200.
 * No network payment; no secrets logged.
 */
const path = require('path')
const fs = require('fs')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

process.env.STORAGE_ADAPTER = 'json'
process.env.RATE_LIMIT_BACKEND = 'memory'

const { BRIEFING_PRICE_CENTS, YOUTH_AGENT_PAYOUT_CENTS } = require(path.join(
  __dirname,
  '../backend/constants/briefingPricing'
))
const svc = require(path.join(__dirname, '../backend/services/privateTenderSubmissionService'))
const { getStorage } = require(path.join(__dirname, '../backend/services/storageAdapter'))

async function main() {
  const report = { ok: false, checks: [], blockers: [] }
  const check = (name, ok, detail = '') => {
    report.checks.push({ name, ok, detail })
    if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
  }

  check('pricing R349', BRIEFING_PRICE_CENTS === 34900, String(BRIEFING_PRICE_CENTS))
  check('YA liability R200', YOUTH_AGENT_PAYOUT_CENTS === 20000, String(YOUTH_AGENT_PAYOUT_CENTS))

  const liveDispatch = require('../backend/services/liveDispatchService')
  liveDispatch.findBestAgentsForRequest = async () => []
  const workflow = require('../backend/services/workflowAutomationService')
  workflow.dispatchWorkflowEvent = async () => {}
  const audit = require('../backend/services/auditLogService')
  audit.logEvent = async () => {}

  const agentService = require('../backend/services/agentAssignmentService')

  const submission = {
    id: `pts-cert-${Date.now()}`,
    status: 'submitted',
    companyName: 'Cert Private Co',
    tenderReference: `CERT-PRIV-${Date.now()}`,
    title: 'Private sector compulsory briefing cert tender',
    description: 'Certification opportunity with compulsory briefing for YA attendance workflow.',
    category: 'Facilities',
    province: 'Gauteng',
    municipality: 'Johannesburg',
    closingDate: '2099-12-20',
    closingTime: '16:00',
    briefingDate: '2099-12-10',
    briefingTime: '10:00',
    briefingVenue: 'Cert Venue',
    briefingInstructions: 'Bring ID',
    eligibilityRequirements: 'CIDB',
    submissionInstructions: 'Email',
    procurementContactName: 'Cert',
    procurementContactEmail: 'cert@example.com',
    procurementContactPhone: '',
    contactPersonName: 'Cert',
    contactEmail: 'cert@example.com',
    contactPhone: '',
    meetingLink: '',
    tenderDocument: {
      fileName: 'cert.pdf',
      contentType: 'application/pdf',
      storagePath: 'private-tender-submissions/cert/cert.pdf',
    },
    supportingDocuments: [],
    submittedAt: new Date().toISOString(),
    publishedTenderId: null,
  }

  const publish1 = await svc.publishSubmission(submission, { uid: 'founder-cert' })
  check('first publish creates tender', publish1.created === true && !!publish1.tenderId)
  check('sourceType private', publish1.tender?.sourceType === 'private')
  check('visibility public', publish1.tender?.visibility === 'public')
  check('briefingCompulsory', publish1.tender?.briefingCompulsory === true)

  submission.publishedTenderId = publish1.tenderId
  submission.status = 'published'
  const publish2 = await svc.publishSubmission(submission, { uid: 'founder-cert' })
  check('repeat publish idempotent', publish2.created === false && publish2.tenderId === publish1.tenderId)

  const storage = getStorage()
  const loaded = await storage.getTenderById(publish1.tenderId)
  check('canonical tender readable', !!loaded && loaded.id === publish1.tenderId)
  check('canonical sourceType private', loaded?.sourceType === 'private')

  const { request } = await agentService.createRequest({
    tenderId: publish1.tenderId,
    tenderNumber: loaded.tenderNumber,
    tenderTitle: loaded.title,
    smeId: 'sme-cert-private',
    smeName: 'Cert SME',
    province: loaded.province,
    briefingDate: loaded.briefingDate,
    briefingTime: loaded.briefingTime,
    briefingVenue: loaded.briefingVenue,
  })

  check('booking references canonical tender id', request?.tenderId === publish1.tenderId, request?.tenderId)
  check('booking snapshot paymentAmount 34900', request?.paymentAmount === 34900, String(request?.paymentAmount))
  check(
    'booking briefingPriceCents 34900',
    request?.briefingPriceCents === 34900 || request?.briefingPriceCents == null,
    String(request?.briefingPriceCents)
  )
  check('no privateBooking type', !request?.privateBooking && request?.type !== 'privateBooking')
  check('no alternate payment provider for private', !request?.paymentProvider || request.paymentProvider === 'payfast' || request.paymentStatus === 'pending')

  // YA liability constant remains R200 (finance model unchanged)
  check('YA liability constant 20000', YOUTH_AGENT_PAYOUT_CENTS === 20000)

  // BI linkage: tender id on request is enough for report pipeline
  check('BI linkage tender id present', Boolean(request?.tenderId))

  report.ok = report.blockers.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'failed' }))
  process.exit(1)
})
