'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

export default function FinalCTA() {
  const { user, userProfile } = useAuth()

  const dashboardHref =
    userProfile?.userType === 'youth-agent'
      ? '/agent/dashboard'
      : userProfile?.userType === 'admin'
        ? '/admin/dashboard'
        : '/sme/dashboard'

  return (
    <section className="bg-white py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[1.75rem] bg-brand-950 px-8 py-16 text-center sm:px-14 sm:py-20"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.18),transparent_50%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl"
            aria-hidden
          />

          <h2 className="relative font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready when the next briefing opens
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-base leading-relaxed text-brand-100/85 sm:text-lg">
            Start free, browse live opportunities, and request attendance support only when you
            need it.
          </p>

          <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {user ? (
              <Link
                href={dashboardHref}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-4 font-semibold text-brand-950 shadow-gold transition hover:bg-accent-400"
              >
                Go to Dashboard
                <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/role-selection"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-4 font-semibold text-brand-950 shadow-gold transition hover:bg-accent-400"
                >
                  Start free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
