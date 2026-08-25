'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'

export default function ProcurementTeamPage() {
  const [members, setMembers] = useState<any[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('procurement')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await authFetch('/api/procurement/team')
    const json = await res.json()
    if (!res.ok) {
      setError(json?.error || 'Failed to load team')
      return
    }
    setMembers(json.data.members || [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function invite() {
    setError(null)
    setMessage(null)
    const res = await authFetch('/api/procurement/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json?.error || 'Invite failed')
      return
    }
    setMessage(json.data.created ? 'Member invited' : 'Member already active')
    setEmail('')
    await load()
  }

  async function disable(membershipId: string) {
    if (!confirm('Disable this membership?')) return
    const res = await authFetch(`/api/procurement/team/${membershipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disabled' }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json?.error || 'Update failed')
      return
    }
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-950">Team</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invite colleagues to manage organisation tenders. Roles: owner, admin, procurement.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="font-semibold text-slate-700">Email</span>
          <input
            type="email"
            className="mt-1 block w-64 rounded-lg border border-slate-200 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="font-semibold text-slate-700">Role</span>
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="procurement">Procurement</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button
          type="button"
          onClick={invite}
          className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
        >
          Invite
        </button>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{m.email}</td>
                <td className="px-4 py-3">{m.role}</td>
                <td className="px-4 py-3">{m.status}</td>
                <td className="px-4 py-3 text-right">
                  {m.role !== 'owner' && m.status === 'active' && (
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-700"
                      onClick={() => disable(m.id)}
                    >
                      Disable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
