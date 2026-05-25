'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { adminPilotFetch } from '@/lib/pilot/adminApi'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ClipboardDocumentIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'

type Lead = {
  id: string
  name: string
  company: string
  role: string
  email: string
  phoneNumber: string
  whatsappNumber: string
  province: string
  sector: string
  source: string
  leadType: 'sme' | 'agent'
  status: string
  notes: string
  linkedUserId?: string | null
  updatedAt: string
}

const STATUSES = ['new', 'contacted', 'interested', 'onboarded', 'rejected']
const MESSAGE_TYPES = [
  { key: 'sme_invitation', label: 'SME invitation' },
  { key: 'agent_recruitment', label: 'Agent recruitment' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'reminder', label: 'Reminder' },
  { key: 'pilot_acceptance', label: 'Pilot acceptance' },
]

type LeadForm = {
  name: string
  company: string
  role: string
  email: string
  phoneNumber: string
  whatsappNumber: string
  province: string
  sector: string
  source: string
  leadType: 'sme' | 'agent'
  status: string
  notes: string
}

const emptyLead: LeadForm = {
  name: '',
  company: '',
  role: '',
  email: '',
  phoneNumber: '',
  whatsappNumber: '',
  province: '',
  sector: '',
  source: 'admin',
  leadType: 'sme',
  status: 'new',
  notes: '',
}

export default function PilotLeadManager() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProvince, setFilterProvince] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [timeline, setTimeline] = useState<Array<Record<string, unknown>>>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyLead)
  const [notesEdit, setNotesEdit] = useState('')

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterType) params.set('leadType', filterType)
    if (filterStatus) params.set('status', filterStatus)
    if (filterProvince) params.set('province', filterProvince)
    if (search) params.set('search', search)
    const data = await adminPilotFetch(`/api/admin/pilot/leads?${params}`)
    setLeads(data)
  }, [filterType, filterStatus, filterProvince, search])

  useEffect(() => {
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [load])

  const selectLead = async (lead: Lead) => {
    setSelected(lead)
    setNotesEdit(lead.notes || '')
    try {
      const data = await adminPilotFetch(`/api/admin/pilot/leads/${lead.id}`)
      setTimeline(data.timeline || [])
    } catch {
      setTimeline([])
    }
  }

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await adminPilotFetch('/api/admin/pilot/leads', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast.success('Lead created')
      setShowForm(false)
      setForm(emptyLead)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed')
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await adminPilotFetch(`/api/admin/pilot/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      toast.success('Status updated')
      load()
      if (selected?.id === id) selectLead({ ...selected, status } as Lead)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const saveNotes = async () => {
    if (!selected) return
    try {
      await adminPilotFetch(`/api/admin/pilot/leads/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: notesEdit }),
      })
      toast.success('Notes saved')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const outreach = async (messageType: string, sendWhatsApp: boolean) => {
    if (!selected) return
    try {
      const result = await adminPilotFetch('/api/admin/pilot/outreach', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selected.id,
          messageType,
          sendWhatsApp,
        }),
      })
      if (result.body) {
        await navigator.clipboard.writeText(result.body)
        toast.success(sendWhatsApp ? 'WhatsApp sent (or logged)' : 'Message copied to clipboard')
      }
      selectLead(selected)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Outreach failed')
    }
  }

  const convertPlaceholder = () => {
    if (!selected) return
    const path =
      selected.leadType === 'agent' ? '/auth/signup?type=youth-agent' : '/auth/signup?type=sme'
    toast.success('Share signup link with lead')
    window.open(path, '_blank')
    updateStatus(selected.id, 'interested')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Search name, company, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="sme">SME</option>
            <option value="agent">Agent</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filterProvince}
            onChange={(e) => setFilterProvince(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All provinces</option>
            {SA_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              load().finally(() => setLoading(false))
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {showForm ? 'Cancel' : 'Add lead'}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={createLead}
            className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={form.leadType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, leadType: e.target.value as 'sme' | 'agent' }))
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="sme">SME lead</option>
                <option value="agent">Agent lead</option>
              </select>
              <input
                placeholder="Name *"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="Company"
                value={form.company}
                onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="WhatsApp / phone"
                value={form.whatsappNumber}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    whatsappNumber: e.target.value,
                    phoneNumber: e.target.value,
                  }))
                }
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={form.province}
                onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Province</option>
                {SA_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
              Save lead
            </button>
          </form>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Province</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => selectLead(lead)}
                  className={`cursor-pointer hover:bg-brand-50/50 ${
                    selected?.id === lead.id ? 'bg-brand-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {lead.name}
                    {lead.company ? (
                      <span className="block text-xs text-slate-500">{lead.company}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 capitalize">{lead.leadType}</td>
                  <td className="px-4 py-3">{lead.province || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {lead.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.length === 0 && (
            <p className="py-8 text-center text-slate-500">No leads yet — add your first pilot lead.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {!selected ? (
          <p className="text-sm text-slate-500">Select a lead to manage outreach and notes.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-900">{selected.name}</h3>
              <p className="text-sm text-slate-500">
                {selected.leadType} · {selected.province || 'No province'}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Status</label>
              <select
                value={selected.status}
                onChange={(e) => updateStatus(selected.id, e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Notes</label>
              <textarea
                value={notesEdit}
                onChange={(e) => setNotesEdit(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={saveNotes}
                className="mt-2 text-sm font-semibold text-brand-700"
              >
                Save notes
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Outreach</p>
              {MESSAGE_TYPES.map((m) => (
                <div key={m.key} className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => outreach(m.key, false)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy {m.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => outreach(m.key, true)}
                    className="flex items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
                    title="Send via Twilio if configured"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={convertPlaceholder}
              className="w-full rounded-lg border border-brand-200 py-2 text-sm font-semibold text-brand-800"
            >
              Convert → signup link
            </button>
            {selected.linkedUserId && (
              <p className="text-xs text-slate-500">Linked user: {selected.linkedUserId}</p>
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Activity timeline</p>
              <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-slate-600">
                {timeline.length === 0 && <li>No outreach logged yet</li>}
                {timeline.map((ev) => (
                  <li key={String(ev.id)} className="rounded bg-slate-50 px-2 py-1">
                    {String(ev.messageType)} · {String(ev.status)} ·{' '}
                    {ev.createdAt
                      ? new Date(String(ev.createdAt)).toLocaleString('en-ZA')
                      : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <Link
          href="/admin/pilot"
          className="mt-6 block text-center text-sm font-semibold text-brand-700 hover:underline"
        >
          ← Pilot dashboard
        </Link>
      </div>
    </div>
  )
}
