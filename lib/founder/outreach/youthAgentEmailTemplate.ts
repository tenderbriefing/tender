/**
 * Approved Founder Youth Agent invitation template — youth-agent-invitation-v1.
 * Hard-coded copy. No LLM. No Founder editing.
 */
import {
  YOUTH_AGENT_OUTREACH_CTA_LABEL,
  YOUTH_AGENT_OUTREACH_CTA_PATH,
  YOUTH_AGENT_OUTREACH_SUBJECT,
  YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION,
} from './featureFlag'
import { buildUnsubscribeToken } from './unsubscribeToken'

const {
  EmailShell,
  EmailTitle,
  EmailIntro,
  PrimaryButton,
  InfoPanel,
} = require('../../emails/components')
const { escapeHtml, firstName, absoluteUrl } = require('../../emails/utils')

export function renderYouthAgentInvitationV1(
  input: { name?: string; email?: string; unsubscribeUrl?: string },
  env: NodeJS.ProcessEnv = process.env
) {
  const first = firstName(input.name, 'there')
  const signupUrl = absoluteUrl(YOUTH_AGENT_OUTREACH_CTA_PATH, env)
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

  const subject = YOUTH_AGENT_OUTREACH_SUBJECT

  const howItWorks = `<ul style="margin:0;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#334155;">
        <li style="margin:0 0 8px;">A company needs someone to attend a briefing in your area</li>
        <li style="margin:0 0 8px;">You go to the briefing</li>
        <li style="margin:0 0 8px;">You listen to what is discussed</li>
        <li style="margin:0 0 8px;">You record the session</li>
        <li style="margin:0 0 8px;">You send the recording to TenderBriefing</li>
        <li style="margin:0;">Once the briefing is completed, you earn R200</li>
      </ul>`

  const whyJoin = `<ul style="margin:0;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#334155;">
        <li style="margin:0 0 8px;">Earn R200 per completed briefing</li>
        <li style="margin:0 0 8px;">Choose opportunities that are close to you</li>
        <li style="margin:0 0 8px;">Take part when it fits your schedule</li>
        <li style="margin:0 0 8px;">Learn how tenders and procurement work</li>
        <li style="margin:0 0 8px;">Meet people in business</li>
        <li style="margin:0;">Build real-world experience</li>
      </ul>`

  const bodyHtml = `
    ${EmailTitle('Earn R200 attending tender briefings near you')}
    ${EmailIntro(`Hi ${escapeHtml(first)},`)}
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      Want to earn R200 for attending a tender briefing?
    </p>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      TenderBriefing is looking for young people across South Africa to attend compulsory tender briefings on behalf of companies.
    </p>
    ${InfoPanel('Here’s how it works:', howItWorks)}
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      That’s it.
    </p>
    ${InfoPanel('Why join TenderBriefing as a Youth Agent?', whyJoin)}
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      You don’t need to write tenders.
    </p>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      You don’t need to sell anything.
    </p>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      You just need to be reliable, professional and attend the briefing.
    </p>
    <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
      If you’re interested, join TenderBriefing as a Youth Agent.
    </p>
    ${PrimaryButton(signupUrl, YOUTH_AGENT_OUTREACH_CTA_LABEL)}
    <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">
      <a href="${escapeHtml(signupUrl)}" style="color:#0f766e;text-decoration:underline;">www.tenderbriefing.co.za</a>
    </p>
    <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">
      TenderBriefing<br/>
      Show up. Learn. Earn R200.
    </p>
  `

  const footerExtra = unsubscribeUrl
    ? `<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;">
        You received this invitation because your contact details were included in a TenderBriefing Youth Agent outreach list.
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Unsubscribe from outreach emails</a>
      </p>`
    : ''

  const html = EmailShell({
    preheader: 'Earn R200 for attending tender briefings near you.',
    bodyHtml: bodyHtml + footerExtra,
    env,
    includeSecurityNotice: false,
  })

  const text = [
    `Hi ${first},`,
    '',
    'Want to earn R200 for attending a tender briefing?',
    '',
    'TenderBriefing is looking for young people across South Africa to attend compulsory tender briefings on behalf of companies.',
    '',
    'Here’s how it works:',
    '',
    '• A company needs someone to attend a briefing in your area',
    '• You go to the briefing',
    '• You listen to what is discussed',
    '• You record the session',
    '• You send the recording to TenderBriefing',
    '• Once the briefing is completed, you earn R200',
    '',
    'That’s it.',
    '',
    'Why join TenderBriefing as a Youth Agent?',
    '',
    '• Earn R200 per completed briefing',
    '• Choose opportunities that are close to you',
    '• Take part when it fits your schedule',
    '• Learn how tenders and procurement work',
    '• Meet people in business',
    '• Build real-world experience',
    '',
    'You don’t need to write tenders.',
    '',
    'You don’t need to sell anything.',
    '',
    'You just need to be reliable, professional and attend the briefing.',
    '',
    'If you’re interested, join TenderBriefing as a Youth Agent.',
    '',
    YOUTH_AGENT_OUTREACH_CTA_LABEL,
    signupUrl,
    '',
    'www.tenderbriefing.co.za',
    '',
    'TenderBriefing',
    'Show up. Learn. Earn R200.',
    '',
    unsubscribeUrl ? `Unsubscribe from outreach emails: ${unsubscribeUrl}` : '',
  ].join('\n')

  return {
    templateVersion: YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION,
    subject,
    html,
    text,
    ctaUrl: signupUrl,
    ctaLabel: YOUTH_AGENT_OUTREACH_CTA_LABEL,
    unsubscribeUrl: unsubscribeUrl || null,
  }
}
