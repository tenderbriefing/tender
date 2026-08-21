import { redirect } from 'next/navigation'
import { legacyBriefingUploadRedirect } from '@/lib/agent/workspace/paths'

/**
 * Legacy structured notes upload form retired.
 * Permanent redirect to Briefing Intelligence submit-evidence (audio + attendance proof).
 */
export default function BriefingReportUploadPage({
  searchParams,
}: {
  searchParams?: { requestId?: string; tenderId?: string }
}) {
  redirect(legacyBriefingUploadRedirect(searchParams?.requestId))
}
