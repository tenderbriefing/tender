'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { auth } from '@/lib/firebase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type FeedbackType = 'sme' | 'agent'

export default function PilotFeedbackForm({ type }: { type: FeedbackType }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rating, setRating] = useState(4)
  const [comments, setComments] = useState('')
  const [workflowIssue, setWorkflowIssue] = useState('')
  const [reportQuality, setReportQuality] = useState(4)
  const [agentReliability, setAgentReliability] = useState(4)
  const [platformUsability, setPlatformUsability] = useState(4)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        toast.error('Please sign in first')
        router.push('/auth/signin')
        return
      }
      const path = type === 'sme' ? '/api/feedback/sme' : '/api/feedback/agent'
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          comments,
          workflowIssue,
          reportQuality: type === 'sme' ? reportQuality : undefined,
          agentReliability: type === 'sme' ? agentReliability : undefined,
          platformUsability,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Submit failed')
      toast.success('Thank you — feedback received')
      setComments('')
      setWorkflowIssue('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5 rounded-2xl border bg-white p-8 shadow-sm">
      <div>
        <label className="text-sm font-semibold text-slate-700">Overall rating (1–5)</label>
        <input
          type="range"
          min={1}
          max={5}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <p className="text-center text-lg font-bold text-brand-700">{rating}</p>
      </div>
      {type === 'sme' && (
        <>
          <div>
            <label className="text-sm font-semibold text-slate-700">Report quality</label>
            <input
              type="range"
              min={1}
              max={5}
              value={reportQuality}
              onChange={(e) => setReportQuality(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Agent reliability</label>
            <input
              type="range"
              min={1}
              max={5}
              value={agentReliability}
              onChange={(e) => setAgentReliability(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>
        </>
      )}
      <div>
        <label className="text-sm font-semibold text-slate-700">Platform usability</label>
        <input
          type="range"
          min={1}
          max={5}
          value={platformUsability}
          onChange={(e) => setPlatformUsability(Number(e.target.value))}
          className="mt-2 w-full"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700">Comments</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700">Workflow issue (optional)</label>
        <input
          value={workflowIssue}
          onChange={(e) => setWorkflowIssue(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="e.g. payment, dispatch, WhatsApp"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-60"
      >
        {loading ? <LoadingSpinner size="sm" /> : 'Submit feedback'}
      </button>
    </form>
  )
}
