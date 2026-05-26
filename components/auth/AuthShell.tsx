import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck, Sparkles, Users } from 'lucide-react'

export default function AuthShell({
  title,
  subtitle,
  children,
  side = 'right',
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  side?: 'left' | 'right'
}) {
  const sideHighlights = [
    {
      icon: ShieldCheck,
      title: 'Official procurement data',
      text: 'Tenders synced from government sources nationwide.',
    },
    {
      icon: Users,
      title: 'Verified Youth Agents',
      text: 'Reliability-scored agents in every province.',
    },
    {
      icon: Sparkles,
      title: 'Free for SMEs',
      text: 'Pay R249 only when you request agent attendance.',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/40 via-white to-accent-50/30">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        <div
          className={`relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 px-10 py-12 text-white lg:flex lg:flex-col ${
            side === 'left' ? 'order-1' : 'order-2'
          }`}
        >
          <div className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
          >
            <defs>
              <pattern id="auth-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M0 28V0h28" fill="none" stroke="#D4AF37" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#auth-grid)" />
          </svg>

          <Link href="/" className="relative flex items-center gap-2.5">
            <Image
              src="/icon.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-10 w-10"
            />
            <span className="text-xl font-bold text-white">
              Tender<span className="text-accent-400">Briefing</span>
            </span>
          </Link>

          <div className="relative mt-12 flex-1 space-y-6">
            <h2 className="text-3xl font-bold leading-tight">
              Win more government work.
              <br />
              <span className="text-accent-400">Never miss a compulsory briefing.</span>
            </h2>
            <p className="text-brand-100/80">
              South Africa&apos;s procurement intelligence platform with a nationwide network of
              verified Youth Agents covering briefings you cannot attend in person.
            </p>

            <ul className="space-y-4 pt-4">
              {sideHighlights.map(({ icon: Icon, title: t, text }) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent-400 ring-1 ring-inset ring-white/10">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">{t}</p>
                    <p className="mt-0.5 text-sm text-brand-100/70">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative mt-10 text-xs text-brand-100/60">
            © {new Date().getFullYear()} TenderBriefing · Procurement intelligence for SA SMEs
          </p>
        </div>

        <div
          className={`flex flex-col justify-center px-4 py-12 sm:px-10 lg:px-14 ${
            side === 'left' ? 'order-2' : 'order-1'
          }`}
        >
          <Link
            href="/"
            className="mb-10 flex items-center justify-center gap-2.5 lg:hidden"
            aria-label="TenderBriefing home"
          >
            <Image src="/icon.png" alt="" width={40} height={40} priority className="h-10 w-10" />
            <span className="text-xl font-bold text-brand-900">
              Tender<span className="text-accent-600">Briefing</span>
            </span>
          </Link>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card sm:p-10">
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-600">
                  <span className="h-1.5 w-6 rounded-full bg-brand-800" />
                  Welcome
                </span>
                <h1 className="mt-3 text-2xl font-bold text-brand-900 sm:text-3xl">{title}</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
              </div>
              {children}
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Need help?{' '}
              <Link href="/support" className="font-semibold text-brand-800 hover:underline">
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
