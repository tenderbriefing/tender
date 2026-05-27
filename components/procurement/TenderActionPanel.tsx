'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bookmark,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Copy,
  Lock,
  Sparkles,
  Star,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/components/providers/AuthProvider'
import { useSmeWorkspaceActions } from '@/hooks/useSmeWorkspaceActions'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'
import {
  buildGoogleCalendarUrl,
  buildIcsContent,
} from '@/lib/procurement/calendarLinks'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

interface TenderActionPanelProps {
  tender: TenderBriefing
  className?: string
  variant?: 'desktop' | 'mobile'
}

const PRICING_HIGHLIGHTS = [
  'Verified Youth Agent attends briefing on your behalf',
  'Structured briefing report within 24 hours',
  'WhatsApp + in-app status updates',
  'SLA-tracked dispatch & attendance proof',
]

function downloadIcs(tender: TenderBriefing) {
  const ics = buildIcsContent(tender)
  if (!ics) {
    toast.error('Briefing date not available — cannot add to calendar')
    return
  }
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tender.tenderNumber || 'tender-briefing'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function TenderActionPanel({
  tender,
  className = '',
  variant = 'desktop',
}: TenderActionPanelProps) {
  const router = useRouter()
  const { user, userProfile } = useAuth()
  const workspace = useSmeWorkspaceActions(tender)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const isClosed = getTenderDisplayStatus(tender) === 'closed'
  const googleUrl = buildGoogleCalendarUrl(tender)

  const handleRequestAttendance = () => {
    if (!user) {
      router.push(`/auth/signin?redirect=/tenders/${tender.id}/request-agent`)
      return
    }
    if (userProfile?.userType && userProfile.userType !== 'sme') {
      toast.error('SME account required to request an agent')
      return
    }
    router.push(`/tenders/${tender.id}/request-agent`)
  }

  const handleSave = async () => {
    try {
      await workspace.toggleSave()
      toast.success(workspace.isSaved ? 'Removed from saved' : 'Saved to your workspace')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Tender link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  if (variant === 'mobile') {
    return (
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-card backdrop-blur lg:hidden ${className}`}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-800">
              Briefing attendance
            </p>
            <p className="truncate text-sm font-bold text-brand-900">
              {ATTENDANCE_FEE_LABEL} per briefing
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-brand-800 transition hover:border-brand-300"
            aria-label={workspace.isSaved ? 'Saved' : 'Save tender'}
          >
            <Bookmark
              className={`h-5 w-5 ${workspace.isSaved ? 'fill-accent-500 text-accent-500' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={handleRequestAttendance}
            disabled={isClosed}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 text-sm font-bold text-brand-900 shadow-gold transition hover:bg-accent-400 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Request Agent
          </button>
        </div>
      </div>
    )
  }

  return (
    <aside className={`space-y-4 lg:sticky lg:top-24 ${className}`}>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-6 text-white shadow-card">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-500/20 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
            <span className="h-1.5 w-6 rounded-full bg-accent-500" />
            Briefing attendance
          </span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-accent-400">{ATTENDANCE_FEE_LABEL}</span>
            <span className="text-sm text-brand-100/70">/ briefing</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-brand-100/80">
            Only pay when you need an agent to attend a compulsory briefing on your behalf. Free
            to browse and receive matches.
          </p>

          <button
            type="button"
            onClick={handleRequestAttendance}
            disabled={isClosed}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3.5 text-sm font-bold text-brand-900 shadow-gold transition hover:bg-accent-400 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {isClosed ? 'Tender closed' : 'Request Youth Agent'}
          </button>

          {!user && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-brand-100/70">
              <Lock className="h-3 w-3" />
              SME sign-in required to submit a request
            </p>
          )}
        </div>

        <ul className="relative mt-6 space-y-2.5 border-t border-white/10 pt-5">
          {PRICING_HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-brand-100/85">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
          Workspace
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleSave}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              workspace.isSaved
                ? 'border-accent-300 bg-accent-50 text-accent-700'
                : 'border-slate-200 bg-white text-brand-900 hover:border-brand-300'
            }`}
          >
            <Bookmark
              className={`h-4 w-4 ${workspace.isSaved ? 'fill-current' : ''}`}
            />
            {workspace.isSaved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              void workspace
                .toggleTrack()
                .then(() =>
                  toast.success(workspace.isTracked ? 'Untracked' : 'Tracking tender')
                )
                .catch((err) =>
                  toast.error(err instanceof Error ? err.message : 'Could not track')
                )
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              workspace.isTracked
                ? 'border-brand-700 bg-brand-50 text-brand-800'
                : 'border-slate-200 bg-white text-brand-900 hover:border-brand-300'
            }`}
          >
            <Star
              className={`h-4 w-4 ${workspace.isTracked ? 'fill-current' : ''}`}
            />
            {workspace.isTracked ? 'Tracking' : 'Track'}
          </button>
        </div>

        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-brand-900 transition hover:border-brand-300"
            disabled={!tender.briefingDate}
          >
            <span className="inline-flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-accent-500" />
              {tender.briefingDate ? 'Add briefing to calendar' : 'No briefing date set'}
            </span>
            {tender.briefingDate && (
              <span className="text-xs text-slate-400">{calendarOpen ? '▴' : '▾'}</span>
            )}
          </button>
          {calendarOpen && googleUrl && (
            <div className="mt-2 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-brand-700" />
                  Google Calendar
                </span>
                <span aria-hidden>↗</span>
              </a>
              <button
                type="button"
                onClick={() => downloadIcs(tender)}
                className="inline-flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-brand-700" />
                  Apple / Outlook (.ics)
                </span>
                <span aria-hidden>⬇</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void copyLink()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-brand-900 transition hover:border-brand-300"
        >
          <Copy className="h-4 w-4 text-brand-700" />
          Copy share link
        </button>
      </section>
    </aside>
  )
}
