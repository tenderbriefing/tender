import TenderCatalogueStaticList from '@/components/tenders/TenderCatalogueStaticList'
import TenderOpportunitiesClient from '@/components/tenders/TenderOpportunitiesClient'
import { getCatalogueInitialPage } from '@/lib/seo/catalogueServerData'

export default async function TenderOpportunitiesPage() {
  const initial = await getCatalogueInitialPage()

  return (
    <TenderOpportunitiesClient
      initial={initial}
      ssrList={<TenderCatalogueStaticList tenders={initial.tenders} />}
    />
  )
}
