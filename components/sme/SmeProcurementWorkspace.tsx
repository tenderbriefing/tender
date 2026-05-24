'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/api/authenticatedFetch'
import ProcurementEmptyState from '@/components/operations/ProcurementEmptyState'
import { Bookmark, Building2, Calendar, CheckSquare, ClipboardList, MapPin, Star } from 'lucide-react'

interface WorkspaceData {
  trackedTenders: Array<{ id: string; title?: string; tenderNumber?: string }>
  savedTenders: Array<{ id: string; title?: string; tenderNumber?: string }>
  workspace: {
    watchedDepartments: string[]
    watchedProvinces: string[]
  }
  upcomingBriefings: Array<{ id: string; tenderTitle?: string; briefingDate?: string; status: string }>
  completedReports: number
  closingSoonCount: number
  attendanceRequests: number
}

function Section({
  title,
  icon: Icon,
  children,
  href,
  actionLabel,
}: {
  title: string
  icon: typeof Star
  children: React.ReactNode
  href?: string
  actionLabel?: string
}) {
  return (
    <section className="procurement-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="procurement-section-title flex items-center gap-2">
          <Icon className="h-5 w-5 text-brand-600" aria-hidden />
          {title}
        </h3>
        {href && actionLabel && (
          <Link href={href} className="text-xs font-semibold text-brand-700 hover:underline">
            {actionLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export default function SmeProcurementWorkspace() {
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/sme/workspace')
      const json = await res.json()
      if (json.success) setData(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <p className="text-sm text-slate-500">Loading procurement workspace…</p>
  }

  if (!data) return null

  const emptyHint = 'Save or track tenders from any tender detail page to build your procurement workspace.'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/tenders"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Browse Tender Opportunities
        </Link>
        <Link
          href="/sme/requests"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          View My Requests
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Tracked Tenders" icon={Star} href="/tenders" actionLabel="Browse">
          {data.trackedTenders.length === 0 ? (
            <p className="text-sm text-slate-500">{emptyHint}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.trackedTenders.map((t) => (
                <li key={t.id}>
                  <Link href={`/tenders/${t.id}`} className="font-medium text-brand-700">
                    {t.tenderNumber || t.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Saved Tenders" icon={Bookmark}>
          {data.savedTenders.length === 0 ? (
            <p className="text-sm text-slate-500">{emptyHint}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.savedTenders.map((t) => (
                <li key={t.id}>
                  <Link href={`/tenders/${t.id}`} className="font-medium text-brand-700">
                    {t.tenderNumber || t.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Watched Departments" icon={Building2}>
          {data.workspace.watchedDepartments.length === 0 ? (
            <p className="text-sm text-slate-500">No departments watched yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.workspace.watchedDepartments.map((d) => (
                <li key={d} className="procurement-stat-chip">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Watched Provinces" icon={MapPin}>
          {data.workspace.watchedProvinces.length === 0 ? (
            <p className="text-sm text-slate-500">No provinces watched yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.workspace.watchedProvinces.map((p) => (
                <li key={p} className="procurement-stat-chip">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="My Attendance Requests" icon={ClipboardList} href="/sme/requests" actionLabel="View all">
          <p className="text-2xl font-bold text-slate-900">{data.attendanceRequests}</p>
          <p className="text-sm text-slate-600">Active attendance requests</p>
        </Section>

        <Section title="Upcoming Briefings" icon={Calendar}>
          {data.upcomingBriefings.length === 0 ? (
            <ProcurementEmptyState
              icon={Calendar}
              title="No upcoming briefings"
              description="Request Youth Agent attendance from a compulsory briefing tender."
              actionLabel="Browse opportunities"
              actionHref="/tenders"
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {data.upcomingBriefings.slice(0, 5).map((b) => (
                <li key={b.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <p className="font-medium text-slate-900">{b.tenderTitle || 'Briefing'}</p>
                  <p className="text-xs text-slate-600">
                    {b.briefingDate
                      ? new Date(b.briefingDate).toLocaleDateString('en-ZA')
                      : 'Date TBC'}{' '}
                    · {b.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Completed Reports" icon={CheckSquare}>
          <p className="text-2xl font-bold text-slate-900">{data.completedReports}</p>
          <p className="text-sm text-slate-600">Briefing reports received from agents</p>
        </Section>

        <Section title="Closing Soon" icon={Calendar} href="/tenders" actionLabel="View tenders">
          <p className="text-2xl font-bold text-red-700">{data.closingSoonCount}</p>
          <p className="text-sm text-slate-600">Opportunities closing within 7 days (platform-wide)</p>
        </Section>

        <Section title="Submission Checklist" icon={CheckSquare}>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="text-brand-600">□</span> Attend compulsory briefing (or assign agent)
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">□</span> Review Briefing Report when submitted
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">□</span> Complete official submission on eTenders
            </li>
          </ul>
        </Section>
      </div>
    </div>
  )
}
