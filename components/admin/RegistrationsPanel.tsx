'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { SA_PROVINCES } from '@/lib/procurement/provinces'

export type RegisteredSme = {
  id: string
  displayName: string
  companyName: string
  email: string
  phone: string
  province: string
  city: string
  csdNumber: string
  categories: string[]
  onboardingCompleted: boolean
  createdAt: string | null
}

export type RegisteredAgent = {
  id: string
  displayName: string
  email: string
  phone: string
  province: string
  city: string
  verificationStatus: string
  verified: boolean
  reliabilityScore: number
  completedBriefingCount: number
  acceptedBriefingCount: number
  transportAvailable: boolean
  preferredServiceAreas: string[]
  onboardingCompleted: boolean
  createdAt: string | null
}

type Tab = 'smes' | 'agents'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function initials(name: string, fallback = '?') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return fallback
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'ok' | 'pending' | 'warn' | 'muted'
  children: React.ReactNode
}) {
  const styles = {
    ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    pending: 'bg-amber-50 text-amber-900 ring-amber-200/80',
    warn: 'bg-red-50 text-red-800 ring-red-200/80',
    muted: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  }[tone]
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${styles}`}
    >
      {children}
    </span>
  )
}

function Avatar({ label, tone }: { label: string; tone: 'sme' | 'agent' }) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        tone === 'sme'
          ? 'bg-brand-100 text-brand-800'
          : 'bg-accent-100 text-accent-800'
      }`}
      aria-hidden
    >
      {label}
    </div>
  )
}

export default function RegistrationsPanel({
  compact = false,
  showHeaderLink = true,
}: {
  compact?: boolean
  showHeaderLink?: boolean
}) {
  const [tab, setTab] = useState<Tab>('smes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [smes, setSmes] = useState<RegisteredSme[]>([])
  const [agents, setAgents] = useState<RegisteredAgent[]>([])
  const [summary, setSummary] = useState({
    totalSmes: 0,
    totalAgents: 0,
    onboardedSmes: 0,
    verifiedAgents: 0,
    pendingAgents: 0,
  })
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('')

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await authFetch('/api/admin/registrations')
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load registrations')
      }
      setSmes(json.data.smes || [])
      setAgents(json.data.agents || [])
      setSummary(
        json.data.summary || {
          totalSmes: 0,
          totalAgents: 0,
          onboardedSmes: 0,
          verifiedAgents: 0,
          pendingAgents: 0,
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredSmes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return smes.filter((s) => {
      if (province && s.province !== province) return false
      if (!q) return true
      return (
        s.companyName.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.csdNumber.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q)
      )
    })
  }, [smes, search, province])

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agents.filter((a) => {
      if (province && a.province !== province) return false
      if (!q) return true
      return (
        a.displayName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q)
      )
    })
  }, [agents, search, province])

  const rows = tab === 'smes' ? filteredSmes : filteredAgents
  const visibleRows = compact ? rows.slice(0, 8) : rows

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
        {error}{' '}
        <button type="button" onClick={load} className="font-semibold underline">
          Retry
        </button>
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50/80 via-white to-brand-50/30 px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-800">
              <span className="h-1.5 w-5 rounded-full bg-accent-500" aria-hidden />
              People
            </span>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-brand-900 sm:text-2xl">
              Registered users
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              SMEs and Youth Agents who signed up on TenderBriefing — search, filter, and review
              onboarding status.
            </p>
          </div>
          {showHeaderLink && compact && (
            <Link
              href="/admin/registrations"
              className="inline-flex items-center gap-1.5 self-start rounded-xl border border-brand-200 bg-white px-3.5 py-2 text-sm font-semibold text-brand-900 transition hover:border-brand-400 hover:bg-brand-50"
            >
              View all
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">SMEs</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-900">
              {summary.totalSmes}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Youth agents
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-900">
              {summary.totalAgents}
            </p>
          </div>
          <div className="rounded-xl border border-accent-200/70 bg-accent-50/40 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-800/80">
              Onboarded SMEs
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-900">
              {summary.onboardedSmes}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800/80">
              Pending agents
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-900">
              {summary.pendingAgents}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="inline-flex rounded-xl bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => setTab('smes')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              tab === 'smes'
                ? 'bg-white text-brand-900 shadow-sm'
                : 'text-slate-600 hover:text-brand-900'
            }`}
          >
            <BuildingOffice2Icon className="h-4 w-4" />
            SMEs
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-600">
              {filteredSmes.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('agents')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              tab === 'agents'
                ? 'bg-white text-brand-900 shadow-sm'
                : 'text-slate-600 hover:text-brand-900'
            }`}
          >
            <UserGroupIcon className="h-4 w-4" />
            Youth agents
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-600">
              {filteredAgents.length}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-[220px]">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'smes' ? 'Search company, email…' : 'Search name, email…'}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">All provinces</option>
            {SA_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        {tab === 'smes' ? (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className="px-5 py-3 sm:px-7">Company</th>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Province</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-5 py-3 text-right sm:px-7">Registered</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-7 py-12 text-center text-slate-500">
                    No SMEs match your filters.
                  </td>
                </tr>
              ) : (
                (visibleRows as RegisteredSme[]).map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-3.5 sm:px-7">
                      <div className="flex items-center gap-3">
                        <Avatar
                          label={initials(s.companyName || s.displayName, 'SM')}
                          tone="sme"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-brand-900">
                            {s.companyName || s.displayName || 'Unnamed SME'}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {s.categories?.[0] || (s.csdNumber ? `CSD ${s.csdNumber}` : '—')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-medium text-slate-800">{s.displayName || '—'}</p>
                      <p className="truncate text-xs text-slate-500">{s.email || '—'}</p>
                      {s.phone && <p className="text-xs text-slate-500">{s.phone}</p>}
                    </td>
                    <td className="px-3 py-3.5 text-slate-700">{s.province || '—'}</td>
                    <td className="px-3 py-3.5">
                      <StatusPill tone={s.onboardingCompleted ? 'ok' : 'pending'}>
                        {s.onboardingCompleted ? 'Onboarded' : 'Incomplete'}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-600 sm:px-7">
                      {formatDate(s.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className="px-5 py-3 sm:px-7">Agent</th>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Province</th>
                <th className="px-3 py-3">Verification</th>
                <th className="px-3 py-3">Jobs</th>
                <th className="px-5 py-3 text-right sm:px-7">Registered</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-7 py-12 text-center text-slate-500">
                    No Youth Agents match your filters.
                  </td>
                </tr>
              ) : (
                (visibleRows as RegisteredAgent[]).map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-50 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-3.5 sm:px-7">
                      <div className="flex items-center gap-3">
                        <Avatar label={initials(a.displayName, 'YA')} tone="agent" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-brand-900">
                            {a.displayName || 'Unnamed agent'}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {a.city ? `${a.city}` : 'Youth Agent'}
                            {a.reliabilityScore != null
                              ? ` · score ${a.reliabilityScore}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="truncate text-slate-800">{a.email || '—'}</p>
                      {a.phone && <p className="text-xs text-slate-500">{a.phone}</p>}
                    </td>
                    <td className="px-3 py-3.5 text-slate-700">{a.province || '—'}</td>
                    <td className="px-3 py-3.5">
                      <StatusPill
                        tone={
                          a.verified || a.verificationStatus === 'verified'
                            ? 'ok'
                            : a.verificationStatus === 'suspended'
                              ? 'warn'
                              : 'pending'
                        }
                      >
                        {a.verificationStatus || 'pending'}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-slate-700">
                      {a.completedBriefingCount ?? 0}
                      <span className="text-slate-400"> / </span>
                      {a.acceptedBriefingCount ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-600 sm:px-7">
                      {formatDate(a.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {compact && rows.length > 8 && (
        <div className="border-t border-slate-100 px-5 py-3 text-center sm:px-7">
          <Link
            href="/admin/registrations"
            className="text-sm font-semibold text-brand-800 hover:underline"
          >
            Show all {rows.length} {tab === 'smes' ? 'SMEs' : 'Youth Agents'}
          </Link>
        </div>
      )}
    </section>
  )
}
