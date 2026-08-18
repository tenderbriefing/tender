'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const NAV = [
  { href: '/founder', label: 'Home', match: (p: string) => p === '/founder' },
  {
    href: '/founder/user-intelligence',
    label: 'User Intelligence',
    match: (p: string) => p.startsWith('/founder/user-intelligence'),
  },
] as const

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
            {NAV.map((item) => {
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
