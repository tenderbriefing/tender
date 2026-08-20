import { notFound } from 'next/navigation'
import ProgrammaticTendersPage from '@/components/seo/ProgrammaticTendersPage'
import {
  getProgrammaticBrowseProps,
  programmaticBrowseMetadata,
} from '@/lib/seo/programmaticBrowseServer'

const SLUG = 'security-services'

export async function generateMetadata() {
  return programmaticBrowseMetadata(SLUG)!
}

export default async function Page() {
  const props = await getProgrammaticBrowseProps(SLUG)
  if (!props) notFound()
  return <ProgrammaticTendersPage slug={props.slug} initial={props.initial} />
}
