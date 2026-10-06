import { redirect } from 'next/navigation'
import { legacyBriefingUploadRedirect } from '@/lib/agent/workspace/paths'

/**
 * Legacy structured notes upload form retired.
 * Permanent redirect to Briefing Intelligence submit-evidence (audio + attendance proof).
 */
export default async function BriefingReportUploadPage(
  props: {
    searchParams?: Promise<{ requestId?: string; tenderId?: string }>
  }
) {
  const searchParams = await props.searchParams;
  redirect(legacyBriefingUploadRedirect(searchParams?.requestId))
}
