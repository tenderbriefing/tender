'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  MapPinIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import { engagementLabel, type EngagementClass } from '@/lib/founder/engagement'

type Tab = 'overview' | 'smes' | 'agents' | 'network' | 'geography' | 'actions'

function EngagementBadge({ value }: { value: EngagementClass | string }) {
  const tone =
    value === 'highly_active' || value === 'active' || value === 're_engaged'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : value === 'at_risk' || value === 'dormant'
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : value === 'onboarding' || value === 'new'
          ? 'bg-brand-50 text-brand-800 ring-brand-200'
          : 'bg-slate-100 text-slate-700 ring-slate-200'
  const label =
    typeof value === 'string' && value in {
      new: 1,
      onboarding: 1,
      exploring: 1,
      active: 1,
      highly_active: 1,
      at_risk: 1,
      dormant: 1,
      re_engaged: 1,
    }
      ? engagementLabel(value as EngagementClass)
      : value
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}
    >
      {label}
    </span>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number | null | undefined
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-brand-900">
        {value == null || value === '' ? '—' : value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export default function FounderUserIntelligencePage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [q, setQ] = useState('')
  const [province, setProvince] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        q,
        province,
      })
      const res = await authFetch(`/api/founder/user-intelligence?${params}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load intelligence')
      }
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [page, q, province])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (uid: string) => {
    setSelectedUid(uid)
    setDetailLoading(true)
    try {
      const res = await authFetch(`/api/founder/users/${uid}`)
      const json = await res.json()
      if (json.success) setDetail(json.data)
      else setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: 'overview', label: 'Overview' },
      { id: 'smes', label: 'SME Intelligence' },
      { id: 'agents', label: 'Youth Agent Intelligence' },
      { id: 'network', label: 'Agent–SME Network' },
      { id: 'geography', label: 'Geography' },
      { id: 'actions', label: 'Action Centre' },
    ],
    []
  )

  return (
    <div className="procurement-shell min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-800">
              Founder · User Intelligence
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-900">
              SME & Youth Agent intelligence
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Separate journeys, engagement, service coverage, and interventions — not a mixed
              generic user list.
            </p>
          </div>
          <Link
            href="/admin/dashboard"
            className="text-sm font-semibold text-brand-800 hover:underline"
          >
            ← Admin command center
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                tab === t.id
                  ? 'bg-brand-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-brand-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(tab === 'smes' || tab === 'agents') && (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => {
                  setPage(1)
                  setQ(e.target.value)
                }}
                placeholder="Search name, company, email…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={province}
              onChange={(e) => {
                setPage(1)
                setProvince(e.target.value)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">All provinces</option>
              {SA_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-24">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}{' '}
            <button type="button" className="font-semibold underline" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {tab === 'overview' && data?.overview && (
              <section className="space-y-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat label="Total registered" value={data.overview.totalRegistered} />
                  <Stat label="SMEs" value={data.overview.totalSmes} />
                  <Stat label="Youth Agents" value={data.overview.totalYouthAgents} />
                  <Stat label="Inactive / at risk" value={data.overview.inactiveUsers} />
                  <Stat label="New SMEs today" value={data.overview.newSmesToday} />
                  <Stat label="New agents today" value={data.overview.newYouthAgentsToday} />
                  <Stat label="Active SMEs today" value={data.overview.activeSmesToday} />
                  <Stat
                    label="Active agents today"
                    value={data.overview.activeYouthAgentsToday}
                  />
                  <Stat
                    label="Avg days on platform (SME)"
                    value={data.overview.averageDaysOnPlatform?.smes}
                  />
                  <Stat
                    label="Avg days on platform (Agent)"
                    value={data.overview.averageDaysOnPlatform?.agents}
                  />
                  <Stat
                    label="SME onboarding rate"
                    value={
                      data.overview.registrationCompletionRate?.smes != null
                        ? `${data.overview.registrationCompletionRate.smes}%`
                        : '—'
                    }
                  />
                  <Stat
                    label="Agent onboarding rate"
                    value={
                      data.overview.registrationCompletionRate?.agents != null
                        ? `${data.overview.registrationCompletionRate.agents}%`
                        : '—'
                    }
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {data.overview.comparisons?.note} Session duration:{' '}
                  {data.overview.averageSessionDuration ?? 'not yet measurable'}.
                </p>
                {Array.isArray(data.dataNotes) && (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                    {data.dataNotes.map((n: string) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {tab === 'smes' && (
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-brand-900">
                    <BuildingOffice2Icon className="h-5 w-5" />
                    SME Intelligence
                  </h2>
                  <p className="text-sm text-slate-600">
                    {data?.smes?.total ?? 0} SMEs · separate from Youth Agents
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Business</th>
                        <th className="px-3 py-3">Location</th>
                        <th className="px-3 py-3">Engagement</th>
                        <th className="px-3 py-3">Activity</th>
                        <th className="px-3 py-3">Agent links</th>
                        <th className="px-5 py-3 text-right">Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.smes?.items || []).map((s: any) => (
                        <tr
                          key={s.id}
                          className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                          onClick={() => openDetail(s.id)}
                        >
                          <td className="px-5 py-3">
                            <p className="font-semibold text-brand-900">
                              {s.companyName || s.displayName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {s.displayName} · {s.email}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            {s.province || '—'}
                            {s.city ? `, ${s.city}` : ''}
                          </td>
                          <td className="px-3 py-3">
                            <EngagementBadge value={s.engagement} />
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            Saved {s.tendersSaved} · Tracked {s.tendersTracked} · Requests{' '}
                            {s.attendanceRequests}
                          </td>
                          <td className="px-3 py-3 tabular-nums">{s.assignedAgentCount}</td>
                          <td className="px-5 py-3 text-right text-xs text-slate-600">
                            {s.registeredAt
                              ? new Date(s.registeredAt).toLocaleDateString('en-ZA')
                              : '—'}
                            <div className="text-slate-400">{s.daysOnPlatform ?? '—'}d</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={data?.smes?.page || 1}
                  totalPages={data?.smes?.totalPages || 1}
                  onChange={setPage}
                />
              </section>
            )}

            {tab === 'agents' && (
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-brand-900">
                    <UserGroupIcon className="h-5 w-5" />
                    Youth Agent Intelligence
                  </h2>
                  <p className="text-sm text-slate-600">
                    {data?.agents?.total ?? 0} agents · service delivery focus
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Agent</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Engagement</th>
                        <th className="px-3 py-3">Portfolio</th>
                        <th className="px-3 py-3">Jobs</th>
                        <th className="px-5 py-3 text-right">Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.agents?.items || []).map((a: any) => (
                        <tr
                          key={a.id}
                          className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                          onClick={() => openDetail(a.id)}
                        >
                          <td className="px-5 py-3">
                            <p className="font-semibold text-brand-900">{a.displayName}</p>
                            <p className="text-xs text-slate-500">
                              {a.email} · {a.province || '—'}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-xs">{a.agentStatus}</td>
                          <td className="px-3 py-3">
                            <EngagementBadge value={a.engagement} />
                          </td>
                          <td className="px-3 py-3 tabular-nums">{a.assignedSmeCount} SMEs</td>
                          <td className="px-3 py-3 text-xs">
                            {a.completedBriefingCount}/{a.acceptedBriefingCount} · score{' '}
                            {a.reliabilityScore}
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-slate-600">
                            {a.registeredAt
                              ? new Date(a.registeredAt).toLocaleDateString('en-ZA')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={data?.agents?.page || 1}
                  totalPages={data?.agents?.totalPages || 1}
                  onChange={setPage}
                />
              </section>
            )}

            {tab === 'network' && (
              <section className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat
                    label="SMEs without agent history"
                    value={data?.network?.smesWithoutAgents}
                  />
                  <Stat
                    label="Agents without SME history"
                    value={data?.network?.agentsWithoutSmes}
                  />
                  <Stat
                    label="Recent attendance-request links"
                    value={data?.network?.pairs?.length ?? 0}
                  />
                </div>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-[11px] uppercase text-slate-500">
                        <th className="px-5 py-3">Request</th>
                        <th className="px-3 py-3">SME</th>
                        <th className="px-3 py-3">Agent</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-5 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.network?.pairs || []).map((p: any) => (
                        <tr key={p.requestId} className="border-b border-slate-50">
                          <td className="px-5 py-2 font-mono text-xs">{p.requestId}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="font-semibold text-brand-800 hover:underline"
                              onClick={() => openDetail(p.smeId)}
                            >
                              {p.smeId.slice(0, 8)}…
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="font-semibold text-brand-800 hover:underline"
                              onClick={() => openDetail(p.agentId)}
                            >
                              {p.agentId.slice(0, 8)}…
                            </button>
                          </td>
                          <td className="px-3 py-2 capitalize">{p.status}</td>
                          <td className="px-5 py-2 text-xs text-slate-600">
                            {p.createdAt
                              ? new Date(p.createdAt).toLocaleString('en-ZA')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  Relationships are derived from attendance requests — not assumed permanent
                  portfolios.
                </p>
              </section>
            )}

            {tab === 'geography' && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-brand-900">
                    <MapPinIcon className="h-5 w-5" />
                    Province coverage (aggregated)
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Exact residential coordinates are not stored. Municipality drill-down is
                    deferred until collected.
                  </p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-[11px] uppercase text-slate-500">
                          <th className="py-2">Province</th>
                          <th className="py-2">SMEs</th>
                          <th className="py-2">Agents</th>
                          <th className="py-2">SME:Agent</th>
                          <th className="py-2">Unassigned SMEs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.geography || []).map((g: any) => (
                          <tr key={g.province} className="border-b border-slate-50">
                            <td className="py-2.5 font-medium">{g.province}</td>
                            <td className="py-2.5 tabular-nums">{g.smes}</td>
                            <td className="py-2.5 tabular-nums">{g.agents}</td>
                            <td className="py-2.5 tabular-nums">
                              {g.ratio == null ? 'n/a' : g.ratio}
                            </td>
                            <td className="py-2.5 tabular-nums">{g.unassignedSmes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {tab === 'actions' && (
              <section className="space-y-3">
                {(data?.actions || []).length === 0 ? (
                  <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    No intervention recommendations right now.
                  </p>
                ) : (
                  data.actions.map((a: any) => (
                    <article
                      key={a.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {a.audience} · {a.priority} priority
                          </p>
                          <h3 className="mt-1 text-base font-bold text-brand-900">{a.title}</h3>
                        </div>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums">
                          {a.affectedCount} affected
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">Why:</span> {a.why}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">Suggested:</span>{' '}
                        {a.suggestedAction}
                      </p>
                    </article>
                  ))
                )}
                <p className="flex items-start gap-2 text-xs text-slate-500">
                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  Recommendations are advisory. No automated messaging or reassignment is
                  performed.
                </p>
              </section>
            )}
          </>
        )}

        {/* Detail drawer */}
        {selectedUid && (
          <div className="fixed inset-0 z-50 flex justify-end bg-brand-950/40">
            <button
              type="button"
              className="h-full flex-1 cursor-default"
              aria-label="Close"
              onClick={() => {
                setSelectedUid(null)
                setDetail(null)
              }}
            />
            <aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
              <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
                <h3 className="font-bold text-brand-900">User intelligence profile</h3>
                <button
                  type="button"
                  className="text-sm font-semibold text-slate-600"
                  onClick={() => {
                    setSelectedUid(null)
                    setDetail(null)
                  }}
                >
                  Close
                </button>
              </div>
              <div className="p-5">
                {detailLoading ? (
                  <LoadingSpinner />
                ) : !detail ? (
                  <p className="text-sm text-slate-600">Unable to load profile.</p>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        {detail.user.userType}
                      </p>
                      <p className="text-xl font-bold text-brand-900">
                        {detail.user.companyName || detail.user.displayName}
                      </p>
                      <p className="text-slate-600">{detail.user.email}</p>
                      <p className="text-slate-600">
                        {detail.user.province}
                        {detail.user.city ? ` · ${detail.user.city}` : ''}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="font-semibold text-brand-900">Activity summary</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Last meaningful:{' '}
                        {detail.summary?.lastMeaningfulAt
                          ? new Date(detail.summary.lastMeaningfulAt).toLocaleString('en-ZA')
                          : '—'}
                      </p>
                      <p className="text-xs text-slate-600">
                        Meaningful events: {detail.summary?.meaningfulEventCount ?? 0} ·
                        Sessions: {detail.summary?.sessionCount ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="mb-2 font-semibold text-brand-900">
                        <ChartBarIcon className="mr-1 inline h-4 w-4" />
                        Timeline (bounded)
                      </p>
                      {(detail.timeline || []).length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No product events yet for this user. Events will appear as the
                          tracker is used.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {detail.timeline.map((e: any) => (
                            <li
                              key={e.eventId}
                              className="rounded-lg border border-slate-100 px-3 py-2 text-xs"
                            >
                              <span className="font-semibold">{e.eventName}</span>
                              <span className="text-slate-500">
                                {' '}
                                · {new Date(e.timestamp).toLocaleString('en-ZA')}
                              </span>
                              {e.pagePath && (
                                <div className="text-slate-500">{e.pagePath}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 font-semibold text-brand-900">
                        Attendance request history
                      </p>
                      {(detail.attendanceRequests || []).length === 0 ? (
                        <p className="text-xs text-slate-500">None</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {detail.attendanceRequests.slice(0, 12).map((r: any) => (
                            <li key={r.id} className="rounded border border-slate-100 px-2 py-1">
                              {r.id} · {r.status}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="font-semibold text-brand-800 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-slate-500">
        Page {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="font-semibold text-brand-800 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  )
}
