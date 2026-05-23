import { Suspense } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import BriefingReportUploadForm from '@/components/briefing/BriefingReportUploadForm'

export default function BriefingReportUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <BriefingReportUploadForm />
    </Suspense>
  )
}
