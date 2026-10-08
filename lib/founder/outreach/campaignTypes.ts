import {
  OUTREACH_TEMPLATE_VERSION,
  YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION,
} from './featureFlag'

export type OutreachCampaignType =
  | 'sme_invitation'
  | 'youth_agent_invitation'
  | 'blank_email'
  | 'composer_custom'

export type OutreachTemplateVersion =
  | typeof OUTREACH_TEMPLATE_VERSION
  | typeof YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION
  | 'composer-v1'

const CAMPAIGN_TYPES: OutreachCampaignType[] = [
  'sme_invitation',
  'youth_agent_invitation',
  'blank_email',
  'composer_custom',
]

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
  if (v === 'blank_email' || v === 'blank') return 'blank_email'
  if (v === 'composer_custom' || v === 'custom' || v === 'composer') return 'composer_custom'
  return null
}

export function templateVersionForCampaignType(type: OutreachCampaignType): OutreachTemplateVersion {
  if (type === 'youth_agent_invitation') return YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION
  if (type === 'blank_email' || type === 'composer_custom') return 'composer-v1'
  return OUTREACH_TEMPLATE_VERSION
}

export function audienceLabel(type: OutreachCampaignType): string {
  if (type === 'youth_agent_invitation') return 'Youth Agent Invitation'
  if (type === 'blank_email') return 'Blank Email'
  if (type === 'composer_custom') return 'Custom Email'
  return 'SME Invitation'
}

export function isComposerCampaignType(type: OutreachCampaignType | string | undefined): boolean {
  return type === 'blank_email' || type === 'composer_custom' || type === 'sme_invitation' || type === 'youth_agent_invitation'
}
