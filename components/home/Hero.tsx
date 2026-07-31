'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

export default function Hero() {
  const { user, userProfile } = useAuth()

  const dashboardHref =
    userProfile?.userType === 'youth-agent'
      ? '/agent/dashboard'
      : userProfile?.userType === 'admin'
        ? '/admin/dashboard'
        : '/sme/dashboard'

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden bg-brand-950 text-white">
      {/* Full-bleed atmosphere */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#16305d_0%,#0a1530_45%,#050b1c_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(212,175,55,0.14),transparent_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_80%,rgba(58,93,150,0.28),transparent_40%)]" />
        <motion.div
          animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.06, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -right-24 top-1/4 h-[420px] w-[420px] rounded-full bg-accent-500/10 blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2], x: [0, 18, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-32 bottom-0 h-[360px] w-[360px] rounded-full bg-brand-500/20 blur-3xl"
        />
        {/* Soft brand mark as visual plane */}
        <div className="absolute inset-x-0 bottom-0 top-[18%] flex items-center justify-center opacity-[0.12]">
          <Image
            src="/brand/mark.png"
            alt=""
            width={640}
            height={640}
            priority
            unoptimized
            className="h-[min(70vw,520px)] w-[min(70vw,520px)] object-contain"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-24 pt-28 text-center sm:px-6 sm:pb-28 sm:pt-32 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <Image
            src="/brand/logo.png"
            alt="TenderBriefing — Find. Track. Win."
            width={480}
            height={320}
            priority
            unoptimized
            className="h-auto w-[min(88vw,420px)] object-contain"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 max-w-3xl font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]"
        >
          Never miss a compulsory briefing
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 max-w-xl text-base leading-relaxed text-brand-100/85 sm:text-lg"
        >
          Discover South African government tenders that require attendance, track what
          matters, and send a verified Youth Agent when you cannot be there.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center"
        >
          {user ? (
            <>
              <Link
                href={dashboardHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-8 py-4 text-base font-semibold text-brand-950 shadow-gold transition hover:bg-accent-400"
              >
                Go to Dashboard
                <ArrowRight className="h-5 w-5" />
              </Link>
              {userProfile?.userType !== 'youth-agent' && (
                <Link
                  href="/tenders"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10"
                >
                  Request Youth Agent
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                href="/auth/role-selection"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-8 py-4 text-base font-semibold text-brand-950 shadow-gold transition hover:bg-accent-400"
              >
                Start free
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/tenders"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10"
              >
                Browse tenders
              </Link>
            </>
          )}
        </motion.div>

        {!user && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-6 text-sm text-brand-200/80"
          >
            Youth Agent?{' '}
            <Link
              href="/auth/signup?type=youth-agent"
              className="font-semibold text-accent-400 underline-offset-4 hover:underline"
            >
              Join the network
            </Link>
          </motion.p>
        )}
      </div>
    </section>
  )
}
