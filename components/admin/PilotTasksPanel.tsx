'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { adminPilotFetch } from '@/lib/pilot/adminApi'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const TASK_TYPES = [
  { value: 'call_sme', label: 'Call SME' },
  { value: 'verify_agent', label: 'Verify agent' },
  { value: 'follow_up_lead', label: 'Follow up lead' },
  { value: 'whatsapp_opt_in', label: 'WhatsApp opt-in' },
  { value: 'report_quality', label: 'Report quality' },
  { value: 'failed_dispatch', label: 'Failed dispatch' },
]

export default function PilotTasksPanel() {
  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [taskType, setTaskType] = useState('follow_up_lead')

  const load = useCallback(async () => {
    try {
      const data = await adminPilotFetch('/api/admin/pilot/tasks')
      setTasks(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addTask = async () => {
    try {
      await adminPilotFetch('/api/admin/pilot/tasks', {
        method: 'POST',
        body: JSON.stringify({ taskType }),
      })
      toast.success('Task created')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const setStatus = async (id: string, status: string) => {
    try {
      await adminPilotFetch(`/api/admin/pilot/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-900">Pilot tasks</h3>
        <div className="flex gap-2">
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addTask}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Add task
          </button>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-slate-100">
        {tasks.length === 0 && (
          <li className="py-6 text-center text-sm text-slate-500">No open tasks</li>
        )}
        {tasks.map((t) => (
          <li key={String(t.id)} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-medium text-slate-900">{String(t.title)}</p>
              <p className="text-xs text-slate-500">
                {String(t.taskType)} · {String(t.status)}
              </p>
            </div>
            {t.status !== 'done' && (
              <button
                type="button"
                onClick={() => setStatus(String(t.id), 'done')}
                className="text-sm font-semibold text-brand-700 hover:underline"
              >
                Mark done
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
