/**
 * Approved Founder SME invitation template — sme-invitation-v1.
 * Hard-coded copy. No LLM. No Founder editing.
 */
import {
  OUTREACH_CTA_LABEL,
  OUTREACH_CTA_PATH,
  OUTREACH_SUBJECT,
  OUTREACH_TEMPLATE_VERSION,
} from './featureFlag'
import { buildUnsubscribeToken } from './unsubscribeToken'

// Existing CJS email design system
const {
  EmailShell,
  EmailTitle,
  EmailIntro,
  PrimaryButton,
  InfoPanel,
} = require('../../emails/components')
const { escapeHtml, firstName, absoluteUrl } = require('../../emails/utils')

export function renderSmeInvitationV1(
  input: { name?: string; companyName?: string; email?: string; unsubscribeUrl?: string },
  env: NodeJS.ProcessEnv = process.env
) {
  const first = firstName(input.name, 'there')
  const tendersUrl = absoluteUrl(OUTREACH_CTA_PATH, env)
  let unsubscribeUrl = String(input.unsubscribeUrl || '').trim()
  if (!unsubscribeUrl && input.email) {
    const token = buildUnsubscribeToken(input.email, env)
    if (token) {
      unsubscribeUrl = absoluteUrl(
        `/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`,
        env
      )
    }
  }

  const subject = OUTREACH_SUBJECT

  const bodyHtml = `
    ${EmailTitle('Compulsory briefings, without the travel')}
    ${EmailIntro(`Hi ${escapeHtml(first)},`)}
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      We’d like to invite you to use TenderBriefing to book a Youth Agent to attend a compulsory tender briefing on behalf of your company — anywhere in South Africa.
    </p>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      Because sometimes the opportunity is in another city.<br/>
      Sometimes the briefing clashes with an important meeting.<br/>
      And sometimes your team simply has better things to do than spend a full day travelling just to attend one session.
    </p>
    ${InfoPanel(
      'With TenderBriefing, you can:',
      `<ul style="margin:0;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#334155;">
        <li style="margin:0 0 8px;">View available compulsory tender briefings</li>
        <li style="margin:0 0 8px;">Book a Youth Agent to attend on your behalf</li>
        <li style="margin:0 0 8px;">Receive attendance proof</li>
        <li style="margin:0;">Get a structured briefing report with the key requirements, clarifications, dates, risks and actions discussed</li>
      </ul>`
    )}
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      No flights.<br/>
      No long drives.<br/>
      No unnecessary time away from the business.
    </p>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      You focus on the tender.<br/>
      We handle the briefing.
    </p>
    <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      It’s a simple way to save time, reduce the cost of participation and give your company the ability to pursue opportunities in more than one place at the same time.
    </p>
    ${PrimaryButton(tendersUrl, OUTREACH_CTA_LABEL)}
    <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">
      <a href="${escapeHtml(tendersUrl)}" style="color:#0f766e;text-decoration:underline;">www.tenderbriefing.co.za</a>
    </p>
    <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">
      TenderBriefing<br/>
      You run the business. We attend the briefing.
    </p>
  `

  const footerExtra = unsubscribeUrl
    ? `<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;">
        You received this invitation because your business details were included in a TenderBriefing SME outreach list.
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Unsubscribe from outreach emails</a>
      </p>`
    : ''

  const html = EmailShell({
    preheader: 'Book a Youth Agent for compulsory tender briefings anywhere in South Africa.',
    bodyHtml: bodyHtml + footerExtra,
    env,
  })

  const text = [
    `Hi ${first},`,
    '',
    'We’d like to invite you to use TenderBriefing to book a Youth Agent to attend a compulsory tender briefing on behalf of your company — anywhere in South Africa.',
    '',
    'Because sometimes the opportunity is in another city.',
    'Sometimes the briefing clashes with an important meeting.',
    'And sometimes your team simply has better things to do than spend a full day travelling just to attend one session.',
    '',
    'With TenderBriefing, you can:',
    '• View available compulsory tender briefings',
    '• Book a Youth Agent to attend on your behalf',
    '• Receive attendance proof',
    '• Get a structured briefing report with the key requirements, clarifications, dates, risks and actions discussed',
    '',
    'No flights.',
    'No long drives.',
    'No unnecessary time away from the business.',
    '',
    'You focus on the tender.',
    'We handle the briefing.',
    '',
    'It’s a simple way to save time, reduce the cost of participation and give your company the ability to pursue opportunities in more than one place at the same time.',
    '',
    OUTREACH_CTA_LABEL,
    tendersUrl,
    '',
    'www.tenderbriefing.co.za',
    '',
    'TenderBriefing',
    'You run the business. We attend the briefing.',
    '',
    unsubscribeUrl ? `Unsubscribe from outreach emails: ${unsubscribeUrl}` : '',
  ].join('\n')

  return {
    templateVersion: OUTREACH_TEMPLATE_VERSION,
    subject,
    html,
    text,
    ctaUrl: tendersUrl,
    ctaLabel: OUTREACH_CTA_LABEL,
    unsubscribeUrl: unsubscribeUrl || null,
  }
}
