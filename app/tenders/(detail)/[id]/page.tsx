import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ClosedTenderBanner from '@/components/procurement/ClosedTenderBanner'
import TenderDetailContextLinks from '@/components/procurement/TenderDetailContextLinks'
import RelatedActiveTenders from '@/components/procurement/RelatedActiveTenders'
import SmeProcurementIntelligencePanel from '@/components/procurement/SmeProcurementIntelligencePanel'
import TenderActionPanel from '@/components/procurement/TenderActionPanel'
import TenderHero from '@/components/procurement/TenderHero'
import TenderIntelligence from '@/components/procurement/TenderIntelligence'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import { isPrivateSectorTender } from '@/lib/privateTenders/publishMapper'
import { getCatalogueInitialPage } from '@/lib/seo/catalogueServerData'
import {
  getIndexableTenderById,
} from '@/lib/seo/publicTenders'
import { tenderHasUsefulHistoricalContent } from '@/lib/seo/tenderSeo'

export default async function TenderDetailsPage({
  params,
}: {
  params: { id: string }
}) {
  const tender = await getIndexableTenderById(params.id)
  if (!tender || !tenderHasUsefulHistoricalContent(tender)) notFound()

  const isClosed = getTenderDisplayStatus(tender) === 'closed'
  const activeTenders = isClosed ? (await getCatalogueInitialPage()).tenders : []
  const privateSector = isPrivateSectorTender(tender)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/20 pb-24 lg:pb-12">
      <Header />
      <ClosedTenderBanner tender={tender} />
      <TenderHero tender={tender} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr,360px]">
          <div className="space-y-8">
            <SmeProcurementIntelligencePanel tenderId={tender.id} />
            <TenderIntelligence tender={tender} />
            {isClosed ? (
              <RelatedActiveTenders
                currentTender={tender}
                activeTenders={activeTenders}
              />
            ) : null}
            <TenderDetailContextLinks tender={tender} />
          </div>
          <TenderActionPanel tender={tender} />
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <p className="text-xs text-slate-500">
            {privateSector ? (
              <>
                Private Sector Tender — supplied by a third-party company and verified for
                catalogue listing. TenderBriefing facilitates discovery and briefing attendance;
                the publisher remains responsible for procurement evaluation and award. Bidders
                must verify requirements from the official tender document.{' '}
              </>
            ) : (
              <>Source: Official eTenders data · </>
            )}
            <Link
              href="/tenders"
              className="font-semibold text-brand-800 hover:text-accent-600"
            >
              All tender opportunities →
            </Link>
          </p>
        </div>
      </main>

      <TenderActionPanel tender={tender} variant="mobile" />
      <Footer />
    </div>
  )
}
