'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AttendanceRequestCard from '@/components/operations/AttendanceRequestCard'
import AgentTrustIndicators from '@/components/operations/AgentTrustIndicators'
import ProcurementEmptyState from '@/components/operations/ProcurementEmptyState'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { toast } from 'react-hot-toast'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { Briefcase, FileText, ClipboardList } from 'lucide-react'

export default function AgentJobsPage() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<EnrichedAttendanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    authFetch('/api/attendance-requests?opportunities=true')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setOpportunities(j.data || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'youth-agent') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  useEffect(() => {
    if (user?.uid && userProfile?.userType === 'youth-agent') load()
  }, [user, userProfile])

  const { available, assigned, completed } = useMemo(() => {
    const uid = user?.uid
    const available = opportunities.filter((o) => o.status === 'pending')
    const assigned = opportunities.filter(
      (o) =>
        (o.status === 'assigned' || o.status === 'accepted') &&
        (o.assignedAgentId === uid || o.agentId === uid)
    )
    const completed = opportunities.filter(
      (o) => o.status === 'completed' && (o.assignedAgentId === uid || o.agentId === uid)
    )
    return { available, assigned, completed }
  }, [opportunities, user?.uid])

  const accept = async (requestId: string) => {
    setActing(requestId)
    try {
      const res = await authFetch(`/api/attendance-requests/${requestId}/accept`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success('Briefing assigned to you')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept')
    } finally {
      setActing(null)
    }
  }

  const decline = async (requestId: string) => {
    setActing(requestId)
    try {
      const res = await authFetch(`/api/attendance-requests/${requestId}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Not available' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success('Assignment declined')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decline')
    } finally {
      setActing(null)
    }
  }

  const actionBtn =
    'min-h-[44px] flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold'

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="border-b border-brand-100 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-sm font-medium text-brand-100">Youth Agent Operations</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Available Briefing Assignments</h1>
          <p className="mt-3 max-w-2xl text-brand-100">
            Let&apos;s make money by attending meetings. Accept compulsory briefing sessions,
            submit attendance proof, and deliver Briefing Reports for SMEs.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <AgentTrustIndicators profile={userProfile} />

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            <section>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <ClipboardList className="h-5 w-5 text-brand-600" />
                My Assigned Briefings ({assigned.length})
              </h2>
              {assigned.length === 0 ? (
                <div className="mt-4">
                  <ProcurementEmptyState
                    icon={Briefcase}
                    title="No assigned briefings"
                    description="When you accept an assignment it will appear here with briefing venue and date details."
                    actionLabel="View available assignments"
                    actionHref="#available"
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {assigned.map((req) => (
                    <AttendanceRequestCard
                      key={req.id}
                      request={req}
                      actions={
                        <>
                          <Link
                            href={`/briefing-reports/upload?requestId=${req.id}&tenderId=${req.tenderId}`}
                            className={`${actionBtn} bg-brand-600 text-white hover:bg-brand-700`}
                          >
                            Submit Briefing Report
                          </Link>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section id="available">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Briefcase className="h-5 w-5 text-brand-600" />
                Available Briefing Assignments ({available.length})
              </h2>
              {available.length === 0 ? (
                <div className="mt-4">
                  <ProcurementEmptyState
                    icon={Briefcase}
                    title="No briefing assignments available"
                    description="No briefing assignments are currently available. New assignments will appear here when SMEs request attendance."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {available.map((req) => (
                    <AttendanceRequestCard
                      key={req.id}
                      request={req}
                      showDeclined={hasDeclines(req)}
                      actions={
                        <>
                          <button
                            type="button"
                            disabled={acting === req.id}
                            onClick={() => accept(req.id)}
                            className={`${actionBtn} bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50`}
                          >
                            Accept Assignment
                          </button>
                          <button
                            type="button"
                            disabled={acting === req.id}
                            onClick={() => decline(req.id)}
                            className={`${actionBtn} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50`}
                          >
                            Decline
                          </button>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <FileText className="h-5 w-5 text-brand-600" />
                Completed Briefing Reports ({completed.length})
              </h2>
              {completed.length === 0 ? (
                <div className="mt-4">
                  <ProcurementEmptyState
                    icon={FileText}
                    title="No completed reports yet"
                    description="Completed briefing reports will appear here after assigned Youth Agents submit attendance notes."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {completed.map((req) => (
                    <AttendanceRequestCard key={req.id} request={req} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

function hasDeclines(req: EnrichedAttendanceRequest) {
  return (req.declines?.length || 0) > 0
}
