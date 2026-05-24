'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AttendanceRequestCard from '@/components/operations/AttendanceRequestCard'
import ProcurementEmptyState from '@/components/operations/ProcurementEmptyState'
import { AgentVerificationBadge } from '@/components/procurement/StatusBadges'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { SyncHealthBadge } from '@/components/procurement/StatusBadges'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import { ClipboardList, Users, Building2 } from 'lucide-react'
import OperationalIntelligencePanel from '@/components/procurement/OperationalIntelligencePanel'
import { useOperationalIntelligence } from '@/hooks/useOperationalIntelligence'
import RequestStatusTimeline from '@/components/operations/RequestStatusTimeline'

type Tab = 'pending' | 'assigned' | 'completed' | 'declined'

interface YouthAgent {
  id: string
  displayName?: string
  email?: string
  province?: string
  verificationStatus?: 'pending' | 'verified' | 'suspended'
  reliabilityScore?: number
  completedBriefingCount?: number
}

export default function OperationsDashboard() {
  const { data: intelligence, loading: intelligenceLoading } = useOperationalIntelligence(30000)
  const [requests, setRequests] = useState<EnrichedAttendanceRequest[]>([])
  const [syncHealth, setSyncHealth] = useState<string>('unknown')
  const [agents, setAgents] = useState<YouthAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [provinceFilter, setProvinceFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [smeFilter, setSmeFilter] = useState('')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const [reqRes, agentRes, syncRes] = await Promise.all([
        authFetch('/api/attendance-requests'),
        authFetch('/api/agents'),
        fetch('/api/sync/status'),
      ])
      const reqJson = await reqRes.json()
      const agentJson = await agentRes.json()
      const syncJson = await syncRes.json()
      if (reqJson.success) setRequests(reqJson.data || [])
      if (agentJson.success) setAgents(agentJson.data || [])
      if (syncJson.success) setSyncHealth(syncJson.data?.apiHealth || 'unknown')
    } catch {
      toast.error('Failed to load operations data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (provinceFilter && r.province !== provinceFilter) return false
      if (departmentFilter && (r.tender?.department || r.department) !== departmentFilter)
        return false
      if (agentFilter && r.assignedAgentId !== agentFilter && r.agentId !== agentFilter)
        return false
      if (smeFilter && r.smeId !== smeFilter) return false
      return true
    })
  }, [requests, provinceFilter, departmentFilter, agentFilter, smeFilter])

  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const r of requests) {
      const d = r.tender?.department || r.department
      if (d) set.add(d)
    }
    return Array.from(set).sort()
  }, [requests])

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  )

  const buckets = useMemo(() => {
    const pending = filteredRequests.filter((r) => r.status === 'pending')
    const assigned = filteredRequests.filter(
      (r) => r.status === 'assigned' || r.status === 'accepted'
    )
    const completed = filteredRequests.filter((r) => r.status === 'completed')
    const declined = filteredRequests.filter((r) => (r.declines?.length || 0) > 0)
    return { pending, assigned, completed, declined }
  }, [filteredRequests])

  const smeOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of requests) {
      map.set(r.smeId, r.smeCompany || r.smeName || r.smeId)
    }
    return Array.from(map.entries())
  }, [requests])

  const smeActivity = useMemo(() => {
    const map = new Map<string, { name: string; requests: number }>()
    for (const req of requests) {
      const key = req.smeId
      const name = req.smeCompany || req.smeName || key
      if (!map.has(key)) map.set(key, { name, requests: 0 })
      map.get(key)!.requests++
    }
    return Array.from(map.values()).sort((a, b) => b.requests - a.requests).slice(0, 10)
  }, [requests])

  const agentActivity = useMemo(() => {
    const map = new Map<
      string,
      { name: string; assigned: number; completed: number; declines: number }
    >()
    for (const agent of agents) {
      map.set(agent.id, {
        name: agent.displayName || agent.email || agent.id,
        assigned: 0,
        completed: 0,
        declines: 0,
      })
    }
    for (const req of requests) {
      const aid = req.assignedAgentId || req.agentId
      if (aid && map.has(aid)) {
        const row = map.get(aid)!
        if (req.status === 'assigned' || req.status === 'accepted') row.assigned++
        if (req.status === 'completed') row.completed++
      }
      for (const d of req.declines || []) {
        if (map.has(d.agentId)) map.get(d.agentId)!.declines++
      }
    }
    return Array.from(map.entries()).map(([id, stats]) => ({ id, ...stats }))
  }, [requests, agents])

  const manualAssign = async (requestId: string) => {
    const agentId = selectedAgent[requestId]
    if (!agentId) {
      toast.error('Select a Youth Agent first')
      return
    }
    setAssigningId(requestId)
    try {
      const res = await authFetch(`/api/attendance-requests/${requestId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success('Youth Agent assigned')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assign failed')
    } finally {
      setAssigningId(null)
    }
  }

  const activeList =
    tab === 'pending'
      ? buckets.pending
      : tab === 'assigned'
        ? buckets.assigned
        : tab === 'completed'
          ? buckets.completed
          : buckets.declined

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending Attendance Requests', count: buckets.pending.length },
    { key: 'assigned', label: 'Assigned Briefings', count: buckets.assigned.length },
    { key: 'completed', label: 'Completed Briefing Reports', count: buckets.completed.length },
    { key: 'declined', label: 'Declined Requests', count: buckets.declined.length },
  ]

  const quickStats = [
    { label: 'Pending', value: buckets.pending.length },
    { label: 'Assigned', value: buckets.assigned.length },
    { label: 'Completed', value: buckets.completed.length },
    { label: 'Youth Agents', value: agents.length },
    { label: 'SME requests', value: requests.length },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const noActivity = requests.length === 0

  return (
    <div className="space-y-8">
      <OperationalIntelligencePanel data={intelligence} loading={intelligenceLoading} />

      <div>
        <p className="text-sm font-semibold text-brand-700 uppercase tracking-wide">
          Procurement operations
        </p>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Operations Control Room</h1>
        <p className="mt-1 text-slate-600">
          Manage attendance requests, manual Youth Agent assignment, and platform activity.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">Sync alerts</span>
        <SyncHealthBadge health={syncHealth} />
        {buckets.pending.length > 0 && (
          <span className="text-xs font-semibold text-amber-800">
            {buckets.pending.length} pending action(s) in assignment queue
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {quickStats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm"
          >
            <p className="text-2xl font-bold text-brand-700">{s.value}</p>
            <p className="text-xs font-medium text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>

      {!noActivity && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Live activity feed</h2>
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm">
            {[...requests]
              .sort(
                (a, b) =>
                  new Date(b.updatedAt || 0).getTime() -
                  new Date(a.updatedAt || 0).getTime()
              )
              .slice(0, 12)
              .map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span className="font-medium text-slate-800 line-clamp-1">
                    {r.tender?.title || r.tenderTitle}
                  </span>
                  <span className="text-xs text-slate-500 capitalize">{r.status}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {noActivity ? (
        <ProcurementEmptyState
          icon={ClipboardList}
          title="No operational activity yet"
          description="No operational activity yet. Attendance requests will appear here once SMEs begin using the platform."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Users className="h-5 w-5 text-brand-600" />
                Agent Activity
              </h2>
              {agentActivity.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No youth agents registered.</p>
              ) : (
                <div className="mt-4 overflow-x-auto procurement-table">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="pb-2 font-semibold">Agent</th>
                        <th className="pb-2 font-semibold">Assigned</th>
                        <th className="pb-2 font-semibold">Completed</th>
                        <th className="pb-2 font-semibold">Declines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentActivity.map((row) => {
                        const agent = agents.find((a) => a.id === row.id)
                        return (
                          <tr key={row.id} className="border-b border-slate-50">
                            <td className="py-2">
                              <p className="font-medium text-slate-900">{row.name}</p>
                              {agent?.verificationStatus && (
                                <AgentVerificationBadge status={agent.verificationStatus} />
                              )}
                            </td>
                            <td className="py-2">{row.assigned}</td>
                            <td className="py-2">{row.completed}</td>
                            <td className="py-2">{row.declines}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Building2 className="h-5 w-5 text-brand-600" />
                SME Activity
              </h2>
              {smeActivity.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No SME requests yet.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {smeActivity.map((row) => (
                    <li
                      key={row.name}
                      className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-900">{row.name}</span>
                      <span className="text-slate-600">{row.requests} request(s)</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="procurement-tabs flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`procurement-tab ${tab === t.key ? 'procurement-tab-active' : 'hover:bg-slate-50'}`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
              >
                <option value="">All provinces</option>
                {SA_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
              >
                <option value="">All agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName || a.email}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={smeFilter}
                onChange={(e) => setSmeFilter(e.target.value)}
              >
                <option value="">All SMEs</option>
                {smeOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {selectedRequest && (
              <section className="mt-6 rounded-xl border border-brand-200 bg-brand-50/40 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-slate-900">Request detail</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedRequestId(null)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Request ID</dt>
                    <dd className="font-mono font-semibold">{selectedRequest.id}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd className="capitalize font-semibold">{selectedRequest.status}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">SME</dt>
                    <dd>{selectedRequest.smeCompany || selectedRequest.smeName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tender number</dt>
                    <dd className="font-mono">
                      {selectedRequest.tender?.tenderNumber || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Department</dt>
                    <dd>
                      {selectedRequest.tender?.department || selectedRequest.department || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Province</dt>
                    <dd>{selectedRequest.province || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Briefing date</dt>
                    <dd>
                      {selectedRequest.briefingDate ||
                        selectedRequest.tender?.briefingDate ||
                        '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Assigned agent</dt>
                    <dd>{selectedRequest.agentName || 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Report</dt>
                    <dd>{selectedRequest.reportId ? 'Submitted' : 'Pending'}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <RequestStatusTimeline
                    request={selectedRequest}
                    hasReport={Boolean(selectedRequest.reportId)}
                  />
                </div>
              </section>
            )}

            <div className="mt-6 space-y-4">
              {activeList.length === 0 ? (
                <p className="text-sm text-slate-500">No requests in this category.</p>
              ) : (
                activeList.map((req) => (
                  <div key={req.id} className="space-y-2">
                    <AttendanceRequestCard
                      request={req}
                      showDeclined={tab === 'declined'}
                      actions={
                        <div className="flex w-full flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRequestId(req.id)}
                            className="min-h-[44px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View request detail
                          </button>
                          {req.status === 'pending' ? (
                            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                              <select
                                className="min-h-[44px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                value={selectedAgent[req.id] || ''}
                                onChange={(e) =>
                                  setSelectedAgent((s) => ({ ...s, [req.id]: e.target.value }))
                                }
                              >
                                <option value="">Manual Agent Assignment…</option>
                                {agents.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.displayName || a.email} — {a.province || 'ZA'}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={assigningId === req.id}
                                onClick={() => manualAssign(req.id)}
                                className="min-h-[44px] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                              >
                                Assign Youth Agent
                              </button>
                            </div>
                          ) : null}
                        </div>
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
