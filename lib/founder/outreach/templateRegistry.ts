import type { OutreachCampaignType } from './campaignTypes'
import { templateVersionForCampaignType } from './campaignTypes'
import { renderSmeInvitationV1 } from './emailTemplate'
import { renderYouthAgentInvitationV1 } from './youthAgentEmailTemplate'

export type OutreachRenderInput = {
  name?: string
  companyName?: string
  email?: string
  unsubscribeUrl?: string
}

export type RenderedOutreachEmail = {
  templateVersion: string
  subject: string
  html: string
  text: string
  ctaUrl: string
  ctaLabel: string
  unsubscribeUrl: string | null
}

export function renderOutreachEmail(
  campaignType: OutreachCampaignType,
  input: OutreachRenderInput,
  env: NodeJS.ProcessEnv = process.env
): RenderedOutreachEmail {
  if (campaignType === 'youth_agent_invitation') {
    return renderYouthAgentInvitationV1(
      { name: input.name, email: input.email, unsubscribeUrl: input.unsubscribeUrl },
      env
    )
  }
  // blank_email / composer_custom fall through to SME chrome only when no composer body
  // is stored on the campaign — sendEngine prefers composer HTML when present.
  return renderSmeInvitationV1(input, env)
}

export function listIdForCampaignType(type: OutreachCampaignType): string {
  if (type === 'youth_agent_invitation') return '<youth-agent-invitation.tenderbriefing.co.za>'
  if (type === 'blank_email' || type === 'composer_custom') {
    return '<founder-composer.tenderbriefing.co.za>'
  }
  return '<sme-invitation.tenderbriefing.co.za>'
}

export { templateVersionForCampaignType }
