'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  BOOK_AGENT_CTA,
  BOOK_AGENT_SIGN_IN_CTA,
} from '@/lib/booking/labels'

interface RequestAttendanceActionProps {
  tender: TenderBriefing
  /** Compact styles for table cells; default suits stacked card layouts. */
  size?: 'compact' | 'default'
  className?: string
}

/**
 * Role-aware book-agent CTA for tender list surfaces.
 * SME → request-agent; guest → sign-in; youth agent / admin → null (no misleading CTA).
 */
export default function RequestAttendanceAction({
  tender,
  size = 'default',
  className = '',
}: RequestAttendanceActionProps) {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const requestHref = `/tenders/${tender.id}/request-agent`
  const isClosed = getTenderDisplayStatus(tender) === 'closed'

  const compact =
    size === 'compact'
      ? 'min-h-[36px] rounded-lg px-2 py-1.5 text-[11px]'
      : 'min-h-[44px] rounded-xl px-3 py-2.5 text-sm'

  const base = `inline-flex w-full items-center justify-center font-semibold transition sm:w-auto ${compact} ${className}`

  if (isClosed) {
    return (
      <span
        className={`${base} cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400`}
        title="This tender is closed"
      >
        Tender closed
      </span>
    )
  }

  if (userProfile?.userType === 'sme') {
    return (
      <Link
        href={requestHref}
        className={`${base} bg-accent-500 text-brand-900 shadow-sm hover:bg-accent-400`}
      >
        {BOOK_AGENT_CTA}
      </Link>
    )
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() =>
          router.push(`/auth/signin?redirect=${encodeURIComponent(requestHref)}`)
        }
        className={`${base} border border-brand-600 bg-white text-brand-800 hover:bg-brand-50`}
      >
        {BOOK_AGENT_SIGN_IN_CTA}
      </button>
    )
  }

  // Youth agents / admins already have View Details elsewhere — no misleading request CTA.
  return null
}
