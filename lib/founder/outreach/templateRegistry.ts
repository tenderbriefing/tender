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
  return renderSmeInvitationV1(input, env)
}

export function listIdForCampaignType(type: OutreachCampaignType): string {
  return type === 'youth_agent_invitation'
    ? '<youth-agent-invitation.tenderbriefing.co.za>'
    : '<sme-invitation.tenderbriefing.co.za>'
}

export { templateVersionForCampaignType }
