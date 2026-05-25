import { ShieldCheck, FileCheck, Users, Zap } from 'lucide-react'

const items = [
  { icon: ShieldCheck, label: 'Official procurement data' },
  { icon: Users, label: 'Verified Youth Agent network' },
  { icon: FileCheck, label: 'Structured briefing reports' },
  { icon: Zap, label: 'Smart dispatch & SLA tracking' },
]

export default function LaunchTrustStrip() {
  return (
    <section className="border-y border-slate-100 bg-slate-50 py-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 sm:px-6 lg:px-8">
        {items.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
          >
            <Icon className="h-5 w-5 text-brand-600" />
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
