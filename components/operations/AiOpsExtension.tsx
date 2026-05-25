'use client'

interface AiOps {
  nationalField?: {
    allProvincesTracked?: number
    activeBriefings?: number
    liveDispatches?: number
  }
  aiInsights?: {
    provinceDemand?: Array<{ province: string; demand: number }>
    opportunityTrends?: Array<{ tenderId?: string; urgencyScore?: number }>
  }
  operationalRisk?: {
    openFraudCount?: number
    dispatchFailures?: number
    slaBreachSignal?: number
  }
  dispatchCongestion?: Array<{ province: string; demand: number; congestion: number }>
  finance?: { commission?: { grossCents?: number } }
}

export default function AiOpsExtension({ aiOps }: { aiOps?: AiOps | null }) {
  if (!aiOps) return null

  return (
    <div className="space-y-6 border-t border-slate-200 pt-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900">AI & national field operations</h2>
        <p className="text-sm text-slate-500">
          Province coverage, AI opportunity trends, fraud signals, and dispatch congestion
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Provinces tracked</p>
          <p className="text-xl font-bold">{aiOps.nationalField?.allProvincesTracked ?? 9}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Active briefings</p>
          <p className="text-xl font-bold">{aiOps.nationalField?.activeBriefings ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-amber-50 p-4">
          <p className="text-xs text-amber-800">Fraud alerts (open)</p>
          <p className="text-xl font-bold text-amber-900">
            {aiOps.operationalRisk?.openFraudCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border bg-red-50 p-4">
          <p className="text-xs text-red-800">SLA risk (&gt;60m)</p>
          <p className="text-xl font-bold text-red-900">
            {aiOps.operationalRisk?.slaBreachSignal ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-semibold text-slate-900">AI opportunity — top provinces</h3>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {(aiOps.aiInsights?.provinceDemand || []).slice(0, 6).map((p) => (
              <li key={p.province} className="flex justify-between">
                <span>{p.province}</span>
                <span>{p.demand} requests</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-semibold text-slate-900">Dispatch congestion</h3>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {(aiOps.dispatchCongestion || []).slice(0, 6).map((p) => (
              <li key={p.province} className="flex justify-between">
                <span>{p.province}</span>
                <span>load {p.congestion}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <a href="/admin/ai-insights" className="font-semibold text-brand-700 hover:underline">
          AI insights →
        </a>
        <a href="/admin/dispatch" className="font-semibold text-brand-700 hover:underline">
          Dispatch ops →
        </a>
        <a href="/admin/fraud" className="font-semibold text-brand-700 hover:underline">
          Fraud center →
        </a>
        <a href="/admin/finance" className="font-semibold text-brand-700 hover:underline">
          Finance →
        </a>
      </div>
    </div>
  )
}
