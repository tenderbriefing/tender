/**
 * Wrap Founder-composed HTML in TenderBriefing email chrome for client compatibility.
 */
import { sanitizeComposerHtml, htmlToPlainText } from './sanitizeComposerHtml'
import { buildUnsubscribeToken } from './unsubscribeToken'

const { EmailShell } = require('../../emails/components')
const { escapeHtml, absoluteUrl } = require('../../emails/utils')

export function renderComposerEmail(input: {
  subject: string
  bodyHtml: string
  recipientEmail?: string
  env?: NodeJS.ProcessEnv
}): { subject: string; html: string; text: string; unsubscribeUrl: string | null } {
  const env = input.env || process.env
  const subject = String(input.subject || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
  const safeBody = sanitizeComposerHtml(input.bodyHtml)
  const styledBody = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      ${safeBody}
    </div>
  `

  let unsubscribeUrl: string | null = null
  if (input.recipientEmail) {
    const token = buildUnsubscribeToken(input.recipientEmail, env)
    if (token) {
      unsubscribeUrl = absoluteUrl(
        `/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`,
        env
      )
    }
  }

  const footer = unsubscribeUrl
    ? `<p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;">
         You received this email from TenderBriefing.
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#0f766e;text-decoration:underline;">Unsubscribe</a>
       </p>`
    : ''

  const html = EmailShell({
    title: subject || 'TenderBriefing',
    preheader: subject || 'Message from TenderBriefing',
    bodyHtml: `${styledBody}${footer}`,
    env,
    includeSecurityNotice: false,
  })
  const text = `${htmlToPlainText(safeBody)}${
    unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : ''
  }`

  return { subject, html, text, unsubscribeUrl }
}
