import type { SeoLandingConfig } from '@/lib/seo/landingTypes'
import { compulsoryBriefingsConfig } from './landingContent/compulsory'
import { southAfricaConfig } from './landingContent/south-africa'
import { briefingAgentConfig } from './landingContent/agent'
import { attendanceConfig } from './landingContent/attendance'
import { rfqConfig } from './landingContent/rfq'
import { youthAgentConfig } from './landingContent/youth-agent'
export const SEO_LANDING_PAGES: Record<string, SeoLandingConfig> = {
  'compulsory-tender-briefings': compulsoryBriefingsConfig,
  'tender-briefings-south-africa': southAfricaConfig,
  'tender-briefing-agent': briefingAgentConfig,
  'tender-briefing-attendance': attendanceConfig,
  'rfq-briefing-support': rfqConfig,
  'youth-agent-tender-support': youthAgentConfig,
}

export const SEO_LANDING_PATHS = Object.keys(SEO_LANDING_PAGES)
