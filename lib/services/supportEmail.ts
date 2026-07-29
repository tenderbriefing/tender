/**
 * Contact / support ticket outbound mail.
 * Uses the existing Gmail service when configured; never blocks ticket creation.
 *
 * Production mail requirements:
 * - Gmail API enabled on the GCP project
 * - Service account with domain-wide delegation for gmail.send
 *   (or OAuth refresh token) so messages.users.send works as support@
 * - GOOGLE_CALENDAR_CLIENT_EMAIL / GOOGLE_CALENDAR_PRIVATE_KEY (same SA currently
 *   used by gmail.ts) with delegated subject support@tenderbriefing.co.za
 * - Optional: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET if migrating to user OAuth
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
          TenderBriefing · Midrand, Gauteng, South Africa
        </p>
      </div>
    </div>
  `.trim()
}

export async function sendSupportTicketEmails(
  ticket: SupportTicketEmailPayload
): Promise<SupportEmailResult> {
  const result: SupportEmailResult = {
    supportEmailSent: false,
    acknowledgementEmailSent: false,
  }

  try {
    const { gmailService } = await import('@/lib/services/gmail')

    // Allow async init a moment to settle
    if (!gmailService.isConfigured()) {
      await new Promise((r) => setTimeout(r, 50))
    }
    if (!gmailService.isConfigured()) {
      result.error = 'Gmail service is not configured'
      console.warn('[supportEmail]', result.error, '— ticket', ticket.id, 'stored without outbound mail')
      return result
    }

    const textBody = [
      `Ticket: ${ticket.id}`,
      `From: ${ticket.requesterName || 'Guest'} <${ticket.requesterEmail}>`,
      `Subject: ${ticket.subject}`,
      `Category: ${ticket.category || 'general'}`,
      `Source: ${ticket.source || 'contact'}`,
      '',
      ticket.body,
    ].join('\n')

    try {
      result.supportEmailSent = await gmailService.sendEmail({
        to: SUPPORT_EMAIL,
        subject: `[Contact] ${ticket.subject}`.slice(0, 200),
        html: supportNotifyHtml(ticket),
        text: textBody,
        replyTo: ticket.requesterEmail,
      })
    } catch (err) {
      console.error('[supportEmail] Failed to notify support@:', err)
      result.error = err instanceof Error ? err.message : 'Support notify failed'
    }

    try {
      result.acknowledgementEmailSent = await gmailService.sendEmail({
        to: ticket.requesterEmail,
        subject: 'We received your enquiry — response within 24 hours',
        html: acknowledgementHtml(ticket),
        text: [
          `Hi ${ticket.requesterName || 'there'},`,
          '',
          `Thank you for contacting TenderBriefing. We have received your enquiry "${ticket.subject}" (ref ${ticket.id}).`,
          '',
          'You will receive a response within 24 hours.',
          '',
          `Questions? Email ${SUPPORT_EMAIL}`,
        ].join('\n'),
        replyTo: SUPPORT_EMAIL,
      })
    } catch (err) {
      console.error('[supportEmail] Failed to send acknowledgement:', err)
      if (!result.error) {
        result.error = err instanceof Error ? err.message : 'Ack email failed'
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Email module unavailable'
    console.error('[supportEmail] Unexpected error:', err)
  }

  return result
}
