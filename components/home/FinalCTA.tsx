'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

export default function FinalCTA() {
  const { user } = useAuth()

  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-8 py-16 text-center shadow-card sm:px-16"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-brand-400/20 blur-2xl" />

          <h2 className="relative text-3xl font-bold text-white sm:text-4xl">
            Ready to Stay Ahead of Tender Opportunities?
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-lg text-brand-100">
            Join SMEs and Youth Agents using TenderBriefing to navigate compulsory tender
            briefings more efficiently.
          </p>

          <div className="relative mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-brand-800 shadow-lg transition hover:bg-brand-50"
              >
                Go to Dashboard
                <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/sme/onboarding"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-brand-800 shadow-lg transition hover:bg-brand-50"
                >
                  SME — Start pilot
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/agent/onboarding"
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
                >
                  Youth Agent — Join
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
