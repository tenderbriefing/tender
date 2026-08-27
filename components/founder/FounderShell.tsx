'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { isFounderDashboardV2EnabledClient } from '@/lib/founder/access'

const V1_NAV = [
  { href: '/founder', label: 'Home', match: (p: string) => p === '/founder' },
  {
    href: '/founder/user-intelligence',
    label: 'User Intelligence',
    match: (p: string) => p.startsWith('/founder/user-intelligence'),
  },
  {
    href: '/founder/outreach',
    label: 'Outreach',
    match: (p: string) => p.startsWith('/founder/outreach'),
  },
] as const

const V2_NAV = [
  { href: '/founder', label: 'Overview', match: (p: string) => p === '/founder' },
  {
    href: '/founder/smes',
    label: 'SMEs',
    match: (p: string) => p.startsWith('/founder/smes'),
  },
  {
    href: '/founder/agents',
    label: 'Youth Agents',
    match: (p: string) => p.startsWith('/founder/agents'),
  },
  {
    href: '/founder/briefings',
    label: 'Briefings',
    match: (p: string) => p.startsWith('/founder/briefings'),
  },
  {
    href: '/founder/finance',
    label: 'Finance',
    match: (p: string) => p.startsWith('/founder/finance'),
  },
  {
    href: '/founder/private-tenders',
    label: 'Private tenders',
    match: (p: string) => p.startsWith('/founder/private-tenders'),
  },
  {
    href: '/founder/outreach',
    label: 'Outreach',
    match: (p: string) => p.startsWith('/founder/outreach'),
  },
] as const

function navActive(pathname: string, href: string, exact = false) {
  if (exact || href === '/founder') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function FounderShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const v2 = isFounderDashboardV2EnabledClient()
  return v2 ? (
    <FounderShellV2 title={title} subtitle={subtitle} actions={actions}>
      {children}
    </FounderShellV2>
  ) : (
    <FounderShellV1 title={title} subtitle={subtitle} actions={actions}>
      {children}
    </FounderShellV1>
  )
}

function FounderShellV1({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const pathname = usePathname() || '/founder'

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-brand-900">
      <Header />
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Founder
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900 sm:text-[1.75rem]">
                {title || 'Home'}
              </h1>
              {subtitle ? (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>

          <nav aria-label="Founder" className="flex gap-1 overflow-x-auto">
            {V1_NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`min-h-[40px] shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-brand-900 text-brand-900'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-brand-800'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <Footer />
    </div>
  )
}

function FounderShellV2({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const pathname = usePathname() || '/founder'
  const router = useRouter()
  const { user } = useAuth()
  const settingsActive = pathname.startsWith('/founder/settings')

  const handleSignOut = async () => {
    await signOut(auth)
    router.replace('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-brand-900">
      <div className="lg:flex lg:min-h-screen">
        <aside className="hidden w-[240px] shrink-0 flex-col bg-brand-900 text-white lg:flex">
          <div className="border-b border-white/10 px-5 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400">
              TenderBriefing
            </p>
            <p className="mt-1 text-sm font-medium text-white/80">Founder</p>
          </div>
          <nav aria-label="Founder" className="flex flex-1 flex-col px-3 py-4">
            <div className="space-y-0.5">
              {V2_NAV.map((item) => {
                const active = navActive(pathname, item.href, item.href === '/founder')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
            <div className="mt-auto border-t border-white/10 pt-3">
              <Link
                href="/founder/settings"
                className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                  settingsActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                Settings
              </Link>
              <p className="mt-3 truncate px-3 text-[11px] text-white/40">
                {user?.email || ''}
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-1 px-3 text-[11px] font-medium text-white/50 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200/80 bg-white">
            <div className="flex items-start justify-between gap-4 px-4 py-5 sm:px-8">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-brand-900">
                  {title || 'Overview'}
                </h1>
                {subtitle ? (
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>
                ) : null}
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
            <nav
              aria-label="Founder"
              className="flex gap-1 overflow-x-auto border-t border-slate-100 px-2 lg:hidden"
            >
              {V2_NAV.map((item) => {
                const active = navActive(pathname, item.href, item.href === '/founder')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`min-h-[44px] shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${
                      active
                        ? 'border-brand-900 text-brand-900'
                        : 'border-transparent text-slate-500'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <Link
                href="/founder/settings"
                className={`min-h-[44px] shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${
                  settingsActive
                    ? 'border-brand-900 text-brand-900'
                    : 'border-transparent text-slate-500'
                }`}
              >
                Settings
              </Link>
            </nav>
          </header>
          <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
