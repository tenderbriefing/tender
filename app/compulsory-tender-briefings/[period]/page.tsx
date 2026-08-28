import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CompulsoryBriefingHubPage from '@/components/seo/CompulsoryBriefingHubPage'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { loadPeriodHubData } from '@/lib/seo/compulsoryBriefingHubServer'
import {
  isBriefingPeriodSlug,
  type BriefingPeriodSlug,
} from '@/lib/seo/compulsoryBriefingPeriods'
import {
  isPeriodHubIndexable,
  periodHubDescription,
  periodHubIntro,
  periodHubPath,
  periodHubTitle,
} from '@/lib/seo/compulsoryBriefingHubs'

export const revalidate = 600

const PERIOD_PARAMS: BriefingPeriodSlug[] = ['today', 'this-week', 'next-week', 'this-month']

export function generateStaticParams() {
  return PERIOD_PARAMS.map((period) => ({ period }))
}

export async function generateMetadata({
  params,
}: {
  params: { period: string }
}): Promise<Metadata> {
  if (!isBriefingPeriodSlug(params.period)) {
    return buildPageMetadata({
      title: 'Briefing period not found',
      description: 'Compulsory tender briefings by date.',
      path: `/compulsory-tender-briefings/${params.period}`,
      noIndex: true,
      noIndexFollow: true,
    })
  }

  const data = await loadPeriodHubData(params.period)
  const indexable = isPeriodHubIndexable(data.tenders.length)

  return buildPageMetadata({
    title: periodHubTitle(params.period),
    description: periodHubDescription(params.period),
    path: periodHubPath(params.period),
    noIndex: !indexable,
    noIndexFollow: !indexable,
    keywords: [
      'compulsory tender briefings',
      'tender briefing dates South Africa',
      params.period.replace(/-/g, ' '),
    ],
  })
}

export default async function PeriodCompulsoryBriefingsPage({
  params,
}: {
  params: { period: string }
}) {
  if (!isBriefingPeriodSlug(params.period)) notFound()

  const data = await loadPeriodHubData(params.period)
  const path = periodHubPath(params.period)

  return (
    <CompulsoryBriefingHubPage
      kind="period"
      path={path}
      title={`${periodHubTitle(params.period)} in South Africa`}
      intro={periodHubIntro(params.period)}
      data={data}
    />
  )
}
