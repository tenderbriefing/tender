'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, Rocket, Users } from 'lucide-react'

const whyItems = [
  {
    title: 'Never miss a compulsory briefing',
    text: 'Filter tenders that require attendance and act before closing dates.',
  },
  {
    title: 'Nationwide Youth Agent coverage',
    text: 'Smart dispatch matches reliable agents by province, distance, and workload.',
  },
  {
    title: 'Procurement intelligence you can use',
    text: 'Structured reports help your bid team — without replacing official submission.',
  },
]

export default function LaunchConversionSection() {
  return (
    <>
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
              Why TenderBriefing
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
              Built for South African procurement reality
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {whyItems.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 font-semibold text-brand-700 hover:underline"
            >
              See how it works
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-brand-50/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
                Commercial pilot
              </p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">
                Join the TenderBriefing pilot launch
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                We are onboarding SMEs and Youth Agents across South Africa. Complete onboarding,
                request your first briefing attendance, and help shape the platform before full
                market launch.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/sme/onboarding"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
                >
                  <Building2 className="h-5 w-5" />
                  SME — Start pilot
                </Link>
                <Link
                  href="/agent/onboarding"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-200 bg-white px-6 py-3 font-semibold text-brand-800 hover:bg-brand-50"
                >
                  <Users className="h-5 w-5" />
                  Youth Agent — Join network
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-brand-200 bg-white p-8 shadow-sm">
              <Rocket className="h-10 w-10 text-brand-600" />
              <ul className="mt-6 space-y-4 text-sm text-slate-700">
                <li>Free tender discovery for all SMEs</li>
                <li>R249 standard briefing attendance support fee</li>
                <li>WhatsApp updates when configured</li>
                <li>Agent reliability tiers: Platinum to At Risk</li>
              </ul>
              <Link
                href="/pricing"
                className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:underline"
              >
                View pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
