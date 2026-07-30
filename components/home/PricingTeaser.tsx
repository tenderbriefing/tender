'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'

export default function PricingTeaser() {
  return (
    <section className="relative overflow-hidden bg-brand-50/40 py-20 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(15,30,61,0.06),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-accent-600">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
            Free to discover. Pay only when you attend.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Browse compulsory briefings at no cost. Request a Youth Agent for{' '}
            <span className="font-semibold text-brand-900">{ATTENDANCE_FEE_LABEL}</span> when
            you need someone on site.
          </p>
          <Link
            href="/pricing"
            className="mt-8 inline-flex items-center gap-2 font-semibold text-brand-800 transition hover:text-accent-700"
          >
            View pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
