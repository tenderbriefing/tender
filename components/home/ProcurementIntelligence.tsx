'use client'

import AnimateIn from '@/components/ui/AnimateIn'
import SectionHeading from '@/components/ui/SectionHeading'
import { Activity, Database, RefreshCw, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

const indicators = [
  { label: 'Official eTenders OCDS API', icon: Database },
  { label: 'Automated enrichment pipeline', icon: RefreshCw },
  { label: '15-minute production sync', icon: Activity },
  { label: 'Enterprise-grade data integrity', icon: ShieldCheck },
]

export default function ProcurementIntelligence() {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-20 text-white lg:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-900/40 via-slate-900 to-slate-900" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Procurement intelligence"
          title="Powered by Official Government Procurement Data"
          description="TenderBriefing uses official procurement data sources and advanced enrichment systems to monitor and organize tender opportunities across South Africa."
        />

        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <AnimateIn>
            <ul className="space-y-4">
              {indicators.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-slate-100">{item.label}</span>
                </li>
              ))}
            </ul>
          </AnimateIn>

          <AnimateIn delay={0.15}>
            <div className="relative rounded-2xl border border-white/10 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-400">Live sync status</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300">
                  <span className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
                  Active
                </span>
              </div>
              <div className="space-y-3">
                {['Tenders ingested', 'Briefings classified', 'Provinces mapped'].map((label, i) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>{label}</span>
                      <span>{[92, 78, 100][i]}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-700">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${[92, 78, 100][i]}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.2 + i * 0.15 }}
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-slate-400 leading-relaxed">
                Data is synchronised from official releases, enriched with briefing detection,
                and stored securely for your team&apos;s operational workflows.
              </p>
            </div>
          </AnimateIn>
        </div>
      </div>
    </section>
  )
}
