'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceGet } from '@/lib/agent/workspace/clientApi'

export default function WorkspaceMessagesPage() {
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await workspaceGet<Array<Record<string, unknown>>>(
          '/api/agent/workspace/messages'
        )
        if (!cancelled) setMessages(data || [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <WorkspaceShell title="Messages">
      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <ul className="space-y-3">
        {messages.map((m) => (
          <li key={String(m.id)}>
            <Link
              href={`/agent/workspace/assignments/${String(m.requestId)}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="text-[11px] font-medium uppercase text-slate-500">
                {String(m.senderRole)} · assignment {String(m.requestId).slice(0, 8)}
              </p>
              <p className="mt-1 text-sm text-slate-900">{String(m.body)}</p>
              <p className="mt-1 text-xs text-slate-400">
                {String(m.createdAt || '').slice(0, 19)}
              </p>
            </Link>
          </li>
        ))}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-slate-500">No assignment messages yet.</p>
        )}
      </ul>
    </WorkspaceShell>
  )
}
