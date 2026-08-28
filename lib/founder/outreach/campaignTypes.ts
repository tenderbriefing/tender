import {
  OUTREACH_TEMPLATE_VERSION,
  YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION,
} from './featureFlag'

export type OutreachCampaignType = 'sme_invitation' | 'youth_agent_invitation'

export type OutreachTemplateVersion =
  | typeof OUTREACH_TEMPLATE_VERSION
  | typeof YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION

const CAMPAIGN_TYPES: OutreachCampaignType[] = ['sme_invitation', 'youth_agent_invitation']

export function isOutreachCampaignType(raw: unknown): raw is OutreachCampaignType {
  return typeof raw === 'string' && (CAMPAIGN_TYPES as string[]).includes(raw)
}

export function parseOutreachCampaignType(raw: unknown): OutreachCampaignType | null {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
  if (v === 'sme_invitation' || v === 'sme') return 'sme_invitation'
  if (v === 'youth_agent_invitation' || v === 'youth_agent' || v === 'youth-agent') {
    return 'youth_agent_invitation'
  }
  return null
}

export function templateVersionForCampaignType(type: OutreachCampaignType): OutreachTemplateVersion {
  if (type === 'youth_agent_invitation') return YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION
  return OUTREACH_TEMPLATE_VERSION
}

export function audienceLabel(type: OutreachCampaignType): string {
  return type === 'youth_agent_invitation' ? 'Youth Agent Invitation' : 'SME Invitation'
}
