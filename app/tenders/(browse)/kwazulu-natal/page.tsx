import ProgrammaticTendersPage from '@/components/seo/ProgrammaticTendersPage'
import { PROGRAMMATIC_TENDER_PAGES, buildProgrammaticMetadata } from '@/lib/seo/programmaticPages'

const config = PROGRAMMATIC_TENDER_PAGES['kwazulu-natal']

export const metadata = buildProgrammaticMetadata(config)

export default function Page() {
  return <ProgrammaticTendersPage slug="kwazulu-natal" />
}
