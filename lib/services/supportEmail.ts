/**
 * Contact / support ticket outbound mail.
 * Prefer Resend (production transactional path); fall back to Gmail when configured.
 * Never blocks ticket creation.
 *
 * Production mail requirements (either path):
 * - Preferred: RESEND_API_KEY (+ optional RESEND_FROM_EMAIL)
 * - Fallback: Gmail API via lib/services/gmail.ts (domain-wide delegation as support@)
 */
import { SUPPORT_EMAIL } from '@/lib/contact'

export type SupportTicketEmailPayload = {
  id: string
  subject: string
  category?: string
  requesterName?: string
  requesterEmail: string
  body: string
  source?: string
}

export type SupportEmailResult = {
  supportEmailSent: boolean
  acknowledgementEmailSent: boolean
  provider?: 'resend' | 'gmail' | 'none'
  error?: string
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function supportNotifyHtml(ticket: SupportTicketEmailPayload) {
  const name = escapeHtml(ticket.requesterName || 'Guest')
  const email = escapeHtml(ticket.requesterEmail)
  const subject = escapeHtml(ticket.subject)
  const category = escapeHtml(ticket.category || 'general')
  const body = escapeHtml(ticket.body).replace(/\n/g, '<br/>')
  const source = escapeHtml(ticket.source || 'contact')

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="background:#0B3D5C;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:18px;">New support enquiry</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 12px;"><strong>Ticket:</strong> ${escapeHtml(ticket.id)}</p>
        <p style="margin:0 0 12px;"><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <p style="margin:0 0 12px;"><strong>Subject:</strong> ${subject}</p>
        <p style="margin:0 0 12px;"><strong>Category:</strong> ${category}</p>
        <p style="margin:0 0 12px;"><strong>Source:</strong> ${source}</p>
        <div style="margin-top:16px;padding:14px;background:#f8fafc;border-radius:8px;">
          ${body}
        </div>
      </div>
    </div>
  `.trim()
}

function acknowledgementHtml(ticket: SupportTicketEmailPayload) {
  const name = escapeHtml(ticket.requesterName || 'there')
  const subject = escapeHtml(ticket.subject)

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="background:#0B3D5C;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:18px;">TenderBriefing</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
        <p>Hi ${name},</p>
        <p>Thank you for contacting TenderBriefing. We have received your enquiry
        <strong>“${subject}”</strong> (ref ${escapeHtml(ticket.id)}).</p>
        <p><strong>You will receive a response within 24 hours.</strong></p>
        <p>If you need to add more detail, reply to this email or write to
        <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
        <p style="margin-top:24px;color:#64748b;font-size:13px;">
          TenderBriefing · Byls Bridge Office Park, Centurion, 0157, South Africa
        </p>
      </div>
    </div>
  `.trim()
}

function textBodies(ticket: SupportTicketEmailPayload) {
  const notify = [
    `Ticket: ${ticket.id}`,
    `From: ${ticket.requesterName || 'Guest'} <${ticket.requesterEmail}>`,
    `Subject: ${ticket.subject}`,
    `Category: ${ticket.category || 'general'}`,
    `Source: ${ticket.source || 'contact'}`,
    '',
    ticket.body,
  ].join('\n')

  const ack = [
    `Hi ${ticket.requesterName || 'there'},`,
    '',
    `Thank you for contacting TenderBriefing. We have received your enquiry "${ticket.subject}" (ref ${ticket.id}).`,
    '',
    'You will receive a response within 24 hours.',
    '',
    `Questions? Email ${SUPPORT_EMAIL}`,
  ].join('\n')

  return { notify, ack }
}

async function sendViaResendRaw(opts: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<boolean> {
  const { Resend } = await import('resend')
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) return false
  const from =
    (process.env.RESEND_FROM_EMAIL || '').trim() ||
    'TenderBriefing <hello@tenderbriefing.co.za>'
  const client = new Resend(apiKey)
  const { error } = await client.emails.send({
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo || SUPPORT_EMAIL,
  })
  if (error) {
    throw new Error(
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message: string }).message)
        : 'Resend send failed'
    )
  }
  return true
}

async function sendViaGmail(opts: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<boolean> {
  const { gmailService } = await import('@/lib/services/gmail')
  if (!gmailService.isConfigured()) {
    await new Promise((r) => setTimeout(r, 50))
  }
  if (!gmailService.isConfigured()) return false
  return gmailService.sendEmail({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  })
}

async function sendOne(opts: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<{ sent: boolean; provider: 'resend' | 'gmail' | 'none'; error?: string }> {
  try {
    if (await sendViaResendRaw(opts)) {
      return { sent: true, provider: 'resend' }
    }
  } catch (err) {
    console.error('[supportEmail] Resend failed:', err)
  }

  try {
    if (await sendViaGmail(opts)) {
      return { sent: true, provider: 'gmail' }
    }
  } catch (err) {
    console.error('[supportEmail] Gmail failed:', err)
    return {
      sent: false,
      provider: 'none',
      error: err instanceof Error ? err.message : 'Gmail send failed',
    }
  }

  return {
    sent: false,
    provider: 'none',
    error: 'No mail provider configured (set RESEND_API_KEY or Gmail SA)',
  }
}

export async function sendSupportTicketEmails(
  ticket: SupportTicketEmailPayload
): Promise<SupportEmailResult> {
  const result: SupportEmailResult = {
    supportEmailSent: false,
    acknowledgementEmailSent: false,
    provider: 'none',
  }

  const { notify, ack } = textBodies(ticket)

  const support = await sendOne({
    to: SUPPORT_EMAIL,
    subject: `[Contact] ${ticket.subject}`.slice(0, 200),
    html: supportNotifyHtml(ticket),
    text: notify,
    replyTo: ticket.requesterEmail,
  })
  result.supportEmailSent = support.sent
  result.provider = support.provider
  if (support.error) result.error = support.error

  const acknowledgement = await sendOne({
    to: ticket.requesterEmail,
    subject: 'We received your enquiry — response within 24 hours',
    html: acknowledgementHtml(ticket),
    text: ack,
    replyTo: SUPPORT_EMAIL,
  })
  result.acknowledgementEmailSent = acknowledgement.sent
  if (acknowledgement.sent && result.provider === 'none') {
    result.provider = acknowledgement.provider
  }
  if (acknowledgement.error && !result.error) {
    result.error = acknowledgement.error
  }

  if (!result.supportEmailSent && !result.acknowledgementEmailSent) {
    console.warn(
      '[supportEmail]',
      result.error || 'mail deferred',
      '— ticket',
      ticket.id,
      'stored without outbound mail'
    )
  }

  return result
}
