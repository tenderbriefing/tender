'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  ClipboardList,
  MessageSquare,
  Wallet,
  Gauge,
  UserRound,
} from 'lucide-react'
import { WORKSPACE_NAV } from '@/lib/agent/workspace/types'

const ICONS = {
  today: CalendarDays,
  assignments: ClipboardList,
  messages: MessageSquare,
  earnings: Wallet,
  performance: Gauge,
  profile: UserRound,
} as const

export default function WorkspaceShell({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col bg-gradient-to-b from-emerald-50/80 via-slate-50 to-slate-100">
      <header className="sticky top-0 z-20 border-b border-emerald-100/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
          TenderBriefing · Agent Workspace
        </p>
        {title && <h1 className="mt-0.5 text-lg font-bold text-slate-900">{title}</h1>}
      </header>
      <main className="flex-1 px-4 py-4 pb-28">{children}</main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
        aria-label="Workspace"
      >
        <div className="mx-auto flex max-w-lg justify-between gap-0.5 px-1 py-1.5">
          {WORKSPACE_NAV.map(({ href, label, key }) => {
            const Icon = ICONS[key]
            const active = pathname === href || pathname?.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] font-semibold ${
                  active ? 'text-brand-700' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
