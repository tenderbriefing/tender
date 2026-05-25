'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MapPin, Wallet, Gauge, Radio, Home } from 'lucide-react'
import OfflineStatusBar from './OfflineStatusBar'
import InstallPrompt from './InstallPrompt'

const NAV = [
  { href: '/agent/mobile/dispatch', label: 'Dispatch', icon: Radio },
  { href: '/agent/mobile/earnings', label: 'Earnings', icon: Wallet },
  { href: '/agent/mobile/performance', label: 'Stats', icon: Gauge },
  { href: '/agent/dashboard', label: 'Web', icon: Home },
] as const

export default function MobileShell({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const hideNav = pathname?.includes('/login')

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col bg-slate-50">
      {!hideNav && (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                TenderBriefing Field
              </p>
              {title && <h1 className="text-lg font-bold text-slate-900">{title}</h1>}
            </div>
            <MapPin className="h-5 w-5 text-brand-600" aria-hidden />
          </div>
          <InstallPrompt />
          <OfflineStatusBar />
        </header>
      )}
      <main className="flex-1 px-4 py-4 pb-24">{children}</main>
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-lg justify-around py-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname?.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-[48px] min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold ${
                    active ? 'text-brand-700' : 'text-slate-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
