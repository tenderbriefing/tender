'use client'

import { ChartBarIcon, XMarkIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { UserDetailPayload } from './types'

export function UserDetailDrawer({
  open,
  loading,
  detail,
  onClose,
}: {
  open: boolean
  loading: boolean
  detail: UserDetailPayload | null
  onClose: () => void
}) {
  if (!open) return null

  const role = detail?.user?.userType
  const roleLabel =
    role === 'youth-agent' ? 'Youth Agent' : role === 'sme' ? 'SME' : role || 'Unknown'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-950/45 backdrop-blur-[2px]">
      <button
        type="button"
        className="h-full flex-1 cursor-default"
        aria-label="Close detail drawer"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              User intelligence
            </p>
            <h3 className="font-bold text-brand-900">Profile detail</h3>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-900"
            onClick={onClose}
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : !detail ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              Unable to load profile.
            </p>
          ) : (
            <div className="space-y-5 text-sm">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-brand-50/50 to-white p-4">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                    role === 'youth-agent'
                      ? 'bg-accent-50 text-accent-900 ring-accent-200'
                      : 'bg-brand-50 text-brand-800 ring-brand-200'
                  }`}
                >
                  {roleLabel}
                </span>
                <p className="mt-2 text-xl font-bold tracking-tight text-brand-900">
                  {detail.user.companyName || detail.user.displayName || 'Unknown'}
                </p>
                <p className="text-slate-600">{detail.user.email || '—'}</p>
                <p className="mt-1 text-slate-600">
                  {detail.user.province || 'Unknown'}
                  {detail.user.city ? ` · ${detail.user.city}` : ''}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-semibold text-brand-900">Activity summary</p>
                <dl className="mt-2 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt>Last meaningful</dt>
                    <dd className="tabular-nums text-slate-800">
                      {detail.summary?.lastMeaningfulAt
                        ? new Date(detail.summary.lastMeaningfulAt).toLocaleString('en-ZA')
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Meaningful events</dt>
                    <dd className="tabular-nums text-slate-800">
                      {detail.summary?.meaningfulEventCount ?? 0}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Sessions</dt>
                    <dd className="tabular-nums text-slate-800">
                      {detail.summary?.sessionCount ?? 0}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 font-semibold text-brand-900">
                  <ChartBarIcon className="h-4 w-4" />
                  Timeline (bounded)
                </p>
                {(detail.timeline || []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
                    No product events yet for this user. Events will appear as the tracker is used.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(detail.timeline || []).map((e, idx) => (
                      <li
                        key={e.eventId || `${e.eventName}-${idx}`}
                        className="rounded-lg border border-slate-100 px-3 py-2 text-xs"
                      >
                        <span className="font-semibold text-brand-900">
                          {e.eventName || 'Unknown event'}
                        </span>
                        <span className="text-slate-500">
                          {' '}
                          ·{' '}
                          {e.timestamp
                            ? new Date(e.timestamp).toLocaleString('en-ZA')
                            : '—'}
                        </span>
                        {e.pagePath && <div className="text-slate-500">{e.pagePath}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 font-semibold text-brand-900">Attendance request history</p>
                {(detail.attendanceRequests || []).length === 0 ? (
                  <p className="text-xs text-slate-500">None</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {(detail.attendanceRequests || []).slice(0, 12).map((r) => (
                      <li
                        key={r.id}
                        className="rounded-lg border border-slate-100 px-2.5 py-1.5"
                      >
                        <span className="font-mono text-slate-600">{r.id}</span>
                        <span className="text-slate-400"> · </span>
                        <span className="capitalize text-slate-800">{r.status || 'Unknown'}</span>
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
  )
}
