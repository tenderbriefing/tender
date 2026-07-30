/**
 * Resend-powered welcome emails for new SME and Youth Agent registrations.
 * Server-only — never import from client components.
 *
 * Env (local `.env.local` or Cloud Run via Secret Manager mount):
 * - RESEND_API_KEY — GSM secret name `Resend_API` → `RESEND_API_KEY` in cloudbuild.yaml
 *   (required to send; missing key → skip + warn, registration continues)
 * - RESEND_FROM_EMAIL — optional plain env (not a secret); default
 *   TenderBriefing <hello@tenderbriefing.co.za>
 */
import { Resend } from 'resend'
import { SUPPORT_EMAIL } from '@/lib/contact'
import { SITE_NAME, SITE_URL } from '@/lib/seo/site'

export type WelcomeEmailRole = 'sme' | 'youth-agent'

export type WelcomeEmailInput = {
  to: string
  displayName: string
  userType: WelcomeEmailRole
  companyName?: string
}

export type WelcomeEmailResult = {
  sent: boolean
  skipped?: boolean
  error?: string
  id?: string
}

type EmailTemplate = {
  subject: string
  html: string
  text: string
}

const DEFAULT_FROM = 'TenderBriefing <hello@tenderbriefing.co.za>'
const BRAND_NAVY = '#0F1E3D'
const BRAND_GOLD = '#D4AF37'

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstName(displayName: string) {
  const trimmed = displayName.trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0]
}

function getResendClient(): Resend | null {
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) return null
  return new Resend(apiKey)
}

function fromAddress(): string {
  const configured = (process.env.RESEND_FROM_EMAIL || '').trim()
  return configured || DEFAULT_FROM
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/$/, '')
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:${BRAND_NAVY};padding:28px 32px;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_GOLD};">
                ${escapeHtml(SITE_NAME)}
              </p>
              <h1 style="margin:10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:26px;line-height:1.25;color:#ffffff;font-weight:700;">
                ${escapeHtml(title)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#334155;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.5;color:#64748b;">
              Questions? Email
              <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_NAVY};">${SUPPORT_EMAIL}</a>
              <br />
              ${escapeHtml(SITE_NAME)} · Midrand, Gauteng, South Africa
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function ctaButton(href: string, label: string): string {
  return `
    <p style="margin:28px 0 8px;">
      <a href="${escapeHtml(href)}"
         style="display:inline-block;background:${BRAND_NAVY};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600;font-size:15px;">
        ${escapeHtml(label)}
      </a>
    </p>
  `
}

function buildSmeTemplate(input: WelcomeEmailInput): EmailTemplate {
  const name = firstName(input.displayName)
  const company = input.companyName?.trim()
  const dashboardUrl = `${baseUrl()}/sme/dashboard`
  const subject = `Welcome to TenderBriefing${company ? ` — ${company}` : ''}`

  const greetingExtra = company
    ? ` We're glad to have <strong>${escapeHtml(company)}</strong> on the platform.`
    : ''

  const html = wrapHtml(
    "You're in — let's win more briefings",
    `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">
        Welcome to TenderBriefing.${greetingExtra}
        You now have a clearer path to compulsory tender briefings — without losing a day on the road.
      </p>
      <p style="margin:0 0 8px;font-weight:600;color:${BRAND_NAVY};">Your next steps</p>
      <ol style="margin:0 0 16px;padding-left:20px;">
        <li style="margin-bottom:8px;">Open your SME dashboard and explore live tenders with compulsory briefings.</li>
        <li style="margin-bottom:8px;">Request a verified Youth Agent to attend on your behalf.</li>
        <li style="margin-bottom:8px;">Receive a structured Briefing Report you can use for bid decisions.</li>
      </ol>
      <p style="margin:0 0 16px;">
        You're not alone in this. Every request you place puts a trained agent in the room so your team can stay focused on the tender itself.
      </p>
      ${ctaButton(dashboardUrl, 'Go to my SME dashboard')}
      <p style="margin:16px 0 0;font-size:14px;color:#64748b;">
        Or visit <a href="${escapeHtml(dashboardUrl)}" style="color:${BRAND_NAVY};">${escapeHtml(dashboardUrl)}</a>
      </p>
    `
  )

  const text = [
    `Hi ${name},`,
    '',
    `Welcome to TenderBriefing.${company ? ` We're glad to have ${company} on the platform.` : ''}`,
    'You now have a clearer path to compulsory tender briefings — without losing a day on the road.',
    '',
    'Your next steps:',
    '1. Open your SME dashboard and explore live tenders with compulsory briefings.',
    '2. Request a verified Youth Agent to attend on your behalf.',
    '3. Receive a structured Briefing Report you can use for bid decisions.',
    '',
    `Go to your dashboard: ${dashboardUrl}`,
    '',
    `Questions? Email ${SUPPORT_EMAIL}`,
    '',
    `${SITE_NAME} · Midrand, Gauteng, South Africa`,
  ].join('\n')

  return { subject, html, text }
}

function buildYouthAgentTemplate(input: WelcomeEmailInput): EmailTemplate {
  const name = firstName(input.displayName)
  const dashboardUrl = `${baseUrl()}/agent/dashboard`
  const onboardingUrl = `${baseUrl()}/agent/onboarding`
  const subject = 'Welcome to TenderBriefing — your Youth Agent journey starts here'

  const html = wrapHtml(
    'Welcome, Youth Agent',
    `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">
        Welcome to TenderBriefing. You've joined a network of Youth Agents who help South African SMEs
        show up for compulsory tender briefings — professionally, reliably, and on time.
      </p>
      <p style="margin:0 0 8px;font-weight:600;color:${BRAND_NAVY};">Your next steps</p>
      <ol style="margin:0 0 16px;padding-left:20px;">
        <li style="margin-bottom:8px;">Complete onboarding so we can verify you for assignments.</li>
        <li style="margin-bottom:8px;">Set your province, city, and availability radius.</li>
        <li style="margin-bottom:8px;">Accept briefing jobs nearby, attend, and submit clear Briefing Reports.</li>
      </ol>
      <p style="margin:0 0 16px;">
        Verification is pending by default — that's normal. Finish your profile and we'll unlock
        paid assignments as soon as you're cleared. Every reliable report builds your reputation and earnings.
      </p>
      ${ctaButton(onboardingUrl, 'Complete my agent onboarding')}
      <p style="margin:12px 0 0;font-size:14px;color:#64748b;">
        Already finished? <a href="${escapeHtml(dashboardUrl)}" style="color:${BRAND_NAVY};">Open your agent dashboard</a>
      </p>
    `
  )

  const text = [
    `Hi ${name},`,
    '',
    'Welcome to TenderBriefing. You\'ve joined a network of Youth Agents who help South African SMEs',
    'show up for compulsory tender briefings — professionally, reliably, and on time.',
    '',
    'Your next steps:',
    '1. Complete onboarding so we can verify you for assignments.',
    '2. Set your province, city, and availability radius.',
    '3. Accept briefing jobs nearby, attend, and submit clear Briefing Reports.',
    '',
    'Verification is pending by default — that\'s normal. Finish your profile and we\'ll unlock',
    'paid assignments as soon as you\'re cleared.',
    '',
    `Complete onboarding: ${onboardingUrl}`,
    `Agent dashboard: ${dashboardUrl}`,
    '',
    `Questions? Email ${SUPPORT_EMAIL}`,
    '',
    `${SITE_NAME} · Midrand, Gauteng, South Africa`,
  ].join('\n')

  return { subject, html, text }
}

export function buildWelcomeEmailTemplate(input: WelcomeEmailInput): EmailTemplate {
  if (input.userType === 'youth-agent') {
    return buildYouthAgentTemplate(input)
  }
  return buildSmeTemplate(input)
}

export function isWelcomeEmailRole(value: unknown): value is WelcomeEmailRole {
  return value === 'sme' || value === 'youth-agent'
}

/**
 * Send a welcome email via Resend. Never throws for missing config —
 * returns { sent: false, skipped: true } so registration can continue.
 */
export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<WelcomeEmailResult> {
  const to = (input.to || '').trim().toLowerCase()
  if (!to || !to.includes('@')) {
    return { sent: false, skipped: true, error: 'Invalid recipient email' }
  }
  if (!isWelcomeEmailRole(input.userType)) {
    return { sent: false, skipped: true, error: 'Unsupported user type for welcome email' }
  }

  const client = getResendClient()
  if (!client) {
    console.warn(
      '[welcomeEmail] RESEND_API_KEY is not set — skipping welcome email for',
      to,
      `(${input.userType})`
    )
    return { sent: false, skipped: true, error: 'RESEND_API_KEY not configured' }
  }

  const template = buildWelcomeEmailTemplate({
    ...input,
    to,
    displayName: input.displayName?.trim() || to.split('@')[0] || 'there',
  })

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress(),
      to: [to],
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: SUPPORT_EMAIL,
    })

    if (error) {
      console.error('[welcomeEmail] Resend error:', error)
      return {
        sent: false,
        error: typeof error === 'object' && error && 'message' in error
          ? String((error as { message: string }).message)
          : 'Resend send failed',
      }
    }

    return { sent: true, id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected welcome email failure'
    console.error('[welcomeEmail] Unexpected error:', err)
    return { sent: false, error: message }
  }
}

/**
 * Fire-and-forget helper for server routes. Logs failures; never throws.
 */
export async function sendWelcomeEmailSafe(input: WelcomeEmailInput): Promise<WelcomeEmailResult> {
  try {
    return await sendWelcomeEmail(input)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Welcome email failed'
    console.error('[welcomeEmail] Safe send caught:', err)
    return { sent: false, error: message }
  }
}
