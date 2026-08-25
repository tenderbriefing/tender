/**
 * Fail-soft transactional emails for private tender publishing.
 */
const { Resend } = require('resend')

const DEFAULT_FROM = 'TenderBriefing <hello@tenderbriefing.co.za>'
const SUPPORT = 'support@tenderbriefing.co.za'

function absoluteUrl(path) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.tenderbriefing.co.za').replace(
    /\/$/,
    ''
  )
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function getClient() {
  const key = (process.env.RESEND_API_KEY || '').trim()
  if (!key) return null
  return new Resend(key)
}

function fromAddress() {
  return (process.env.RESEND_FROM_EMAIL || '').trim() || DEFAULT_FROM
}

async function sendSimple({ to, subject, text, html, idempotencyKey }) {
  const recipient = String(to || '')
    .trim()
    .toLowerCase()
  if (!recipient.includes('@')) return { sent: false, skipped: true }

  const client = getClient()
  if (!client) {
    console.warn('[privateTenderEmail] RESEND_API_KEY missing — skip', idempotencyKey)
    return { sent: false, skipped: true, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { error } = await client.emails.send({
      from: fromAddress(),
      to: [recipient],
      subject,
      text,
      html: html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
      replyTo: SUPPORT,
      headers: idempotencyKey ? { 'X-Entity-Ref-ID': idempotencyKey } : undefined,
    })
    if (error) {
      return {
        sent: false,
        error: typeof error === 'object' && error && 'message' in error ? String(error.message) : 'send failed',
      }
    }
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'send failed' }
  }
}

async function sendPrivateTenderSubmittedAck(input) {
  const trackUrl = absoluteUrl(`/submit-tender/status/${input.trackingToken}`)
  const subject = `TenderBriefing received your tender: ${input.tenderReference}`
  const text = [
    `Hello ${input.companyName},`,
    '',
    'We have received your private tender submission for verification.',
    '',
    `Title: ${input.title}`,
    `Reference: ${input.tenderReference}`,
    `Tracking: ${trackUrl}`,
    '',
    'Submission does not guarantee publication. TenderBriefing verifies opportunities before they appear in the catalogue.',
    'TenderBriefing does not manage your procurement evaluation or award process.',
    '',
    '— TenderBriefing',
  ].join('\n')
  return sendSimple({
    to: input.to,
    subject,
    text,
    idempotencyKey: `PRIVATE_TENDER_SUBMITTED:${input.submissionId}`,
  })
}

async function sendPrivateTenderPublished(input) {
  const tenderUrl = absoluteUrl(`/tenders/${input.publishedTenderId}`)
  const subject = `Your tender is published on TenderBriefing: ${input.tenderReference}`
  const text = [
    `Hello ${input.companyName},`,
    '',
    'Your private tender has been verified and published on TenderBriefing.',
    '',
    `Title: ${input.title}`,
    `Reference: ${input.tenderReference}`,
    `View: ${tenderUrl}`,
    '',
    'SMEs can discover the opportunity and appoint a Youth Agent for compulsory briefing attendance (R349).',
    'You remain responsible for procurement rules, evaluation, and award.',
    '',
    '— TenderBriefing',
  ].join('\n')
  return sendSimple({
    to: input.to,
    subject,
    text,
    idempotencyKey: `PRIVATE_TENDER_PUBLISHED:${input.submissionId}`,
  })
}

async function sendPrivateTenderRejected(input) {
  const subject = `TenderBriefing update: ${input.tenderReference}`
  const text = [
    `Hello ${input.companyName},`,
    '',
    `We are unable to publish your tender submission (${input.tenderReference}) at this time.`,
    '',
    input.reason ? `Reason: ${input.reason}` : '',
    '',
    'You may revise and resubmit via the private tender form if appropriate.',
    '',
    '— TenderBriefing',
  ]
    .filter(Boolean)
    .join('\n')
  return sendSimple({
    to: input.to,
    subject,
    text,
    idempotencyKey: `PRIVATE_TENDER_REJECTED:${input.submissionId}`,
  })
}

async function sendPrivateTenderChangesRequested(input) {
  const subject = `Changes requested: ${input.tenderReference}`
  const text = [
    `Hello ${input.companyName},`,
    '',
    `We need additional information before we can publish ${input.tenderReference}.`,
    '',
    input.note ? `Requested changes: ${input.note}` : '',
    '',
    'Please reply to support@tenderbriefing.co.za with the updates, or submit a revised tender.',
    '',
    '— TenderBriefing',
  ]
    .filter(Boolean)
    .join('\n')
  return sendSimple({
    to: input.to,
    subject,
    text,
    idempotencyKey: `PRIVATE_TENDER_CHANGES:${input.submissionId}:${Date.now()}`,
  })
}

module.exports = {
  sendPrivateTenderSubmittedAck,
  sendPrivateTenderPublished,
  sendPrivateTenderRejected,
  sendPrivateTenderChangesRequested,
}
