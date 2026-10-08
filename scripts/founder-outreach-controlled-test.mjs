#!/usr/bin/env node
/**
 * Controlled 2–3 recipient Outreach Composer V2 live test (candidate branch code).
 * Production Firestore + Resend. No merge/deploy. No campaign lists.
 */
import { createRequire } from 'module'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.chdir(path.join(__dirname, '..'))
const require = createRequire(import.meta.url)

function loadEnvLocal() {
  try {
    require('./load-env-local').loadEnvLocal()
  } catch {
    /* optional */
  }
}

function secret(name) {
  return execSync(
    `gcloud secrets versions access latest --secret=${name} --project=tenderbriefing-34679`,
    { encoding: 'utf8' }
  ).trim()
}

loadEnvLocal()
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = secret('tenderbriefing-firebase-sa')
}
if (!process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = secret('TENDERBRIEFING_API')
}
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
process.env.STORAGE_ADAPTER = 'firestore'
process.env.FOUNDER_SME_OUTREACH_ENABLED = 'true'
process.env.FOUNDER_USER_INTELLIGENCE_ENABLED =
  process.env.FOUNDER_USER_INTELLIGENCE_ENABLED || 'true'

const { parseRecipientFields } = await import('../lib/founder/outreach/parseRecipients.ts')
const { resolveAuthorizedSender } = await import('../lib/founder/outreach/authorizedSenders.ts')
const { individualEmailConfirmCopy, labelDeliveryStatus } = await import(
  '../lib/founder/outreach/statusLabels.ts'
)
const { sanitizeComposerHtml } = await import('../lib/founder/outreach/sanitizeComposerHtml.ts')
const { createComposerCampaign, listDeliveries, getCampaign } = await import(
  '../lib/founder/outreach/campaignStore.ts'
)
const { confirmAndStartCampaign, processCampaignSends } = await import(
  '../lib/founder/outreach/sendEngine.ts'
)
const { sendFounderOutreachEmail, fromAddress } = await import(
  '../lib/services/founderOutreachEmail.ts'
)
const { getFirebaseAdmin } = await import('../lib/backend/firebaseAdmin.ts')

const report = {
  candidateSha: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
  startedAt: new Date().toISOString(),
  checks: [],
  blockers: [],
  recipients: [],
}

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail: String(detail).slice(0, 300) })
  if (!ok) report.blockers.push(`${name}: ${detail}`)
}

check(
  'candidate_sha',
  report.candidateSha === 'bd390b982bcd088859f4a6dc254be1792b29a89b' ||
    report.candidateSha.startsWith('bd390b9'),
  report.candidateSha
)

const spoof = resolveAuthorizedSender('spoofed-attacker')
report.unauthorizedFrom = { spoofRejected: spoof === null }
check('unauthorized_from_rejected', spoof === null)

const authorized = resolveAuthorizedSender('primary')
report.fromIdentity = authorized?.display || fromAddress()
check('authorized_from_present', Boolean(authorized?.email), report.fromIdentity)

const parsed = parseRecipientFields({
  to: 'info@tenderbriefing.co.za',
  cc: 'support@tenderbriefing.co.za',
  bcc: 'info@tenderbriefing.co.za',
})
report.dedupe = {
  totalSendable: parsed.totalSendable,
  toCount: parsed.toCount,
  ccCount: parsed.ccCount,
  bccCount: parsed.bccCount,
}
check(
  'dedupe_to_over_bcc',
  parsed.totalSendable === 2 && parsed.toCount === 1 && parsed.ccCount === 1,
  JSON.stringify(report.dedupe)
)

const confirmCopy = individualEmailConfirmCopy(parsed.totalSendable)
report.confirmation = { copy: confirmCopy, count: parsed.totalSendable }
check('confirmation_copy', confirmCopy === 'You are about to send 2 individual emails.', confirmCopy)

const dirty =
  '<p>Controlled outreach test</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>'
const clean = sanitizeComposerHtml(dirty)
report.sanitization = {
  outputHasScript: clean.includes('<script'),
  outputHasJavascriptUrl: /javascript:/i.test(clean),
}
check(
  'html_sanitized',
  !report.sanitization.outputHasScript && !report.sanitization.outputHasJavascriptUrl,
  clean.slice(0, 100)
)

const idemKey = `outreach-controlled-test:${Date.now()}:info@tenderbriefing.co.za`
const probePayload = {
  to: 'info@tenderbriefing.co.za',
  subject: '[CONTROLLED TEST] Outreach Composer V2 idempotency probe',
  html: '<p>Idempotency probe — ignore.</p>',
  text: 'Idempotency probe — ignore.',
  idempotencyKey: idemKey,
}
const first = await sendFounderOutreachEmail(probePayload)
const second = await sendFounderOutreachEmail(probePayload)
report.restartBoundary = {
  firstSent: first.sent,
  firstId: first.id || null,
  firstError: first.error || null,
  secondSent: second.sent,
  secondId: second.id || null,
  secondError: second.error || null,
  sameMessageId: Boolean(first.id && first.id === second.id),
}
check('resend_idempotency_same_key', report.restartBoundary.sameMessageId, JSON.stringify(report.restartBoundary))

const db = getFirebaseAdmin().firestore()
const founderEmail = 'info@tenderbriefing.co.za'
const founderUser = await getFirebaseAdmin().auth().getUserByEmail(founderEmail)

const bodyHtml = sanitizeComposerHtml(`
  <h2>Controlled Outreach Composer V2 test</h2>
  <p>Founder-approved controlled test (2 unique recipients). Not a campaign list.</p>
  <p>Candidate SHA: ${report.candidateSha}</p>
  <script>alert('should not survive')</script>
`)

const campaign = await createComposerCampaign({
  db,
  createdByUid: founderUser.uid,
  createdByEmail: founderEmail,
  campaignType: 'blank_email',
  templateKey: 'blank',
  subject: '[CONTROLLED TEST] Outreach Composer V2 — privacy + To/Cc check',
  composerHtml: bodyHtml,
  fromAddress: authorized.display,
  recipients: parsed.sendable.map((r) => ({
    email: r.email,
    normalisedEmail: r.normalisedEmail,
    field: r.field,
  })),
  toCount: parsed.toCount,
  ccCount: parsed.ccCount,
  bccCount: parsed.bccCount,
  idempotencyKey: `controlled-test-${Date.now()}`,
})

report.campaignId = campaign.id
await confirmAndStartCampaign({
  db,
  campaignId: campaign.id,
  founderUid: founderUser.uid,
})

const tick = await processCampaignSends({ db, campaignId: campaign.id, maxToProcess: 50 })
report.sendTick = tick

const deliveries = await listDeliveries(db, campaign.id, { limit: 50 })
const fresh = await getCampaign(db, campaign.id)

for (const d of deliveries) {
  report.recipients.push({
    email: d.normalisedEmail,
    deliveryId: d.id,
    recipientField: d.recipientField || null,
    resendMessageId: d.resendMessageId || null,
    internalStatus: d.status,
    founderVisibleStatus: labelDeliveryStatus(d.status),
    providerAcceptance: d.providerAcceptance || null,
    error: d.errorMessageSafe || null,
  })
}

report.submittedCount = report.recipients.filter((r) => r.internalStatus === 'sent').length
report.failedCount = report.recipients.filter((r) => r.internalStatus === 'failed').length
report.queuedRemaining = report.recipients.filter((r) =>
  ['queued', 'sending'].includes(r.internalStatus)
).length
report.finalCampaignStatus = fresh?.status || null
report.historyCounts = {
  sendableRows: fresh?.sendableRows,
  sentCount: fresh?.sentCount,
  failedCount: fresh?.failedCount,
  toCount: fresh?.toCount,
  ccCount: fresh?.ccCount,
  bccCount: fresh?.bccCount,
}

check('two_unique_recipients_recorded', report.recipients.length === 2, `rows=${report.recipients.length}`)
check(
  'all_accounted',
  report.submittedCount + report.failedCount + report.queuedRemaining === 2,
  JSON.stringify({
    submitted: report.submittedCount,
    failed: report.failedCount,
    queued: report.queuedRemaining,
  })
)
check(
  'submitted_not_delivered_label',
  report.recipients
    .filter((r) => r.internalStatus === 'sent')
    .every((r) => r.founderVisibleStatus === 'SUBMITTED'),
  report.recipients.map((r) => r.founderVisibleStatus).join(',')
)
check('no_script_in_stored_html', !(fresh?.composerHtml || '').includes('<script'))

report.privacy = {
  oneRecipientPerDelivery: report.recipients.every(
    (r) => Boolean(r.email) && !String(r.email).includes(',')
  ),
  fields: report.recipients.map((r) => ({ email: r.email, field: r.recipientField })),
  transportContract: 'sendFounderOutreachEmail uses to:[single] only — no cc/bcc arrays',
}
check('privacy_one_address_per_delivery', report.privacy.oneRecipientPerDelivery)

const tick2 = await processCampaignSends({ db, campaignId: campaign.id, maxToProcess: 50 })
report.partialResume = {
  secondTickProcessed: tick2.processed,
  secondTickSent: tick2.sent,
  noDuplicateResubmit: tick2.sent === 0,
}
check('partial_resume_no_resend', tick2.sent === 0, JSON.stringify(report.partialResume))

report.verdict =
  report.blockers.length === 0 && report.submittedCount === 2 && report.restartBoundary.sameMessageId
    ? 'PASS'
    : 'FAIL'
report.finishedAt = new Date().toISOString()
report.resendSubmissions = report.submittedCount + (report.restartBoundary.firstSent ? 1 : 0)

console.log(JSON.stringify(report, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
