import SeoLandingPage from '@/components/seo/SeoLandingPage'
import { SEO_LANDING_PAGES } from '@/lib/seo/landingPages'
import { buildPageMetadata } from '@/lib/seo/metadata'

const config = SEO_LANDING_PAGES['youth-agent-tender-support']

export const dynamic = 'force-dynamic'

export const metadata = buildPageMetadata({
  title: config.title,
  description: config.metaDescription,
  path: config.path,
  keywords: ['tender briefing South Africa', 'compulsory tender briefings', config.title],
})

export default function Page() {
  return <SeoLandingPage config={config} />
}
