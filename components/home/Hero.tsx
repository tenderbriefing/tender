'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import DashboardPreview from './DashboardPreview'
import LiveProcurementStats from './LiveProcurementStats'

export default function Hero() {
  const { user, userProfile } = useAuth()

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-white to-brand-50/30 pt-8 pb-20 lg:pt-12 lg:pb-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[480px] w-[480px] rounded-full bg-brand-100/50 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-72 w-72 rounded-full bg-accent-100/40 blur-3xl" />
        <motion.div
          animate={{ y: [0, -12, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-24 right-1/4 h-2 w-2 rounded-full bg-accent-500"
        />
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-40 left-1/4 h-3 w-3 rounded-full bg-brand-400"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-white px-4 py-2 text-sm font-medium text-brand-900 shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-accent-500" />
            Built on official procurement data · Regularly updated from government sources
            <span className="h-2 w-2 rounded-full bg-accent-500 animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl lg:text-6xl lg:leading-[1.1]"
          >
            Never miss a{' '}
            <span className="bg-gradient-to-r from-brand-800 to-accent-600 bg-clip-text text-transparent">compulsory briefing</span> again
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-3xl text-lg text-slate-600 sm:text-xl leading-relaxed"
          >
            TenderBriefing shows you only the South African government tenders that{' '}
            <strong className="text-brand-900">require a compulsory briefing</strong>. Track them,
            request a verified Youth Agent to attend on your behalf, and receive a structured
            briefing report so your team can focus on winning bids.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-4 text-base text-slate-500"
          >
            Free briefing discovery for SMEs. Verified agents nationwide. Official procurement
            data refreshed from government sources.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            {user ? (
              <Link
                href={
                  userProfile?.userType === 'youth-agent'
                    ? '/agent/dashboard'
                    : userProfile?.userType === 'admin'
                      ? '/admin/dashboard'
                      : '/sme/dashboard'
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-800 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-brand-700 hover:shadow-lg"
              >
                Go to Dashboard
                <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/sme/onboarding"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-brand-800 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-brand-700"
                >
                  I&apos;m an SME — Start free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/agent/onboarding"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-accent-500 px-8 py-4 text-base font-semibold text-brand-900 shadow-gold transition hover:bg-accent-400"
                >
                  I&apos;m a Youth Agent
                </Link>
                <Link
                  href="/tenders"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-semibold text-brand-800 hover:text-accent-600 hover:underline"
                >
                  Browse tenders
                </Link>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500"
          >
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-600" />
              Uses official government procurement data
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-600" />
              Nationwide Youth Agent network
            </span>
          </motion.div>

          <LiveProcurementStats />
        </div>

        <DashboardPreview />
      </div>
    </section>
  )
}
