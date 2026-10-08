/**
 * Optional template presets for the Founder Outreach composer.
 * Templates prepopulate subject/body; Founder may edit freely before send.
 */
import {
  OUTREACH_CTA_LABEL,
  OUTREACH_CTA_PATH,
  OUTREACH_SUBJECT,
  YOUTH_AGENT_OUTREACH_CTA_LABEL,
  YOUTH_AGENT_OUTREACH_CTA_PATH,
  YOUTH_AGENT_OUTREACH_SUBJECT,
} from './featureFlag'

export type ComposerTemplateKey = 'blank' | 'sme_invitation' | 'youth_agent_invitation'

export type ComposerTemplate = {
  key: ComposerTemplateKey
  label: string
  subject: string
  /** Inner body HTML (sanitized-friendly) for the rich editor */
  html: string
}

const { absoluteUrl } = require('../../emails/utils')

export function listComposerTemplates(env: NodeJS.ProcessEnv = process.env): ComposerTemplate[] {
  const tendersUrl = absoluteUrl(OUTREACH_CTA_PATH, env)
  const yaUrl = absoluteUrl(YOUTH_AGENT_OUTREACH_CTA_PATH, env)

  return [
    {
      key: 'blank',
      label: 'Blank Email',
      subject: '',
      html: '<p></p>',
    },
    {
      key: 'sme_invitation',
      label: 'SME Invitation',
      subject: OUTREACH_SUBJECT,
      html: `
        <h2>Compulsory briefings, without the travel</h2>
        <p>Hi there,</p>
        <p>We’d like to invite you to use TenderBriefing to book a Youth Agent to attend a compulsory tender briefing on behalf of your company — anywhere in South Africa.</p>
        <p>Because sometimes the opportunity is in another city.<br/>Sometimes the briefing clashes with an important meeting.<br/>And sometimes your team simply has better things to do than spend a full day travelling just to attend one session.</p>
        <p><strong>With TenderBriefing, you can:</strong></p>
        <ul>
          <li>View available compulsory tender briefings</li>
          <li>Book a Youth Agent to attend on your behalf</li>
          <li>Receive attendance proof</li>
          <li>Get a structured briefing report with the key requirements, clarifications, dates, risks and actions discussed</li>
        </ul>
        <p>No flights.<br/>No long drives.<br/>No unnecessary time away from the business.</p>
        <p>You focus on the tender.<br/>We handle the briefing.</p>
        <p><a href="${tendersUrl}">${OUTREACH_CTA_LABEL}</a></p>
        <p>TenderBriefing<br/>You run the business. We attend the briefing.</p>
      `.trim(),
    },
    {
      key: 'youth_agent_invitation',
      label: 'Youth Agent Invitation',
      subject: YOUTH_AGENT_OUTREACH_SUBJECT,
      html: `
        <h2>Invitation to become Youth Agents</h2>
        <p>Hi there,</p>
        <p>TenderBriefing is inviting motivated young people to join our Youth Agent network — attending compulsory tender briefings on behalf of South African SMEs and earning for verified attendance.</p>
        <p><strong>As a Youth Agent you will:</strong></p>
        <ul>
          <li>Attend compulsory briefings in your area</li>
          <li>Capture attendance evidence</li>
          <li>Contribute to structured briefing reports</li>
          <li>Build reliable work experience in public procurement</li>
        </ul>
        <p><a href="${yaUrl}">${YOUTH_AGENT_OUTREACH_CTA_LABEL}</a></p>
        <p>TenderBriefing<br/>Connecting SMEs with Youth Agents nationwide.</p>
      `.trim(),
    },
  ]
}

export function getComposerTemplate(
  key: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env
): ComposerTemplate {
  const list = listComposerTemplates(env)
  return list.find((t) => t.key === key) || list[0]
}
