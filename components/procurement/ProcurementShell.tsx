'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { isPrivateTenderOrganisationWorkspaceUiEnabled } from '@/lib/privateTenders/organisationWorkspaceFlag'

const NAV = [
  { href: '/procurement', label: 'Dashboard', exact: true },
  { href: '/procurement/tenders', label: 'Tenders' },
  { href: '/procurement/tenders/new', label: 'New Tender' },
  { href: '/procurement/organisation', label: 'Organisation' },
  { href: '/procurement/team', label: 'Team' },
]

export default function ProcurementShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    if (!isPrivateTenderOrganisationWorkspaceUiEnabled()) {
      setError('Organisation workspace is not enabled.')
      return
    }
    if (loading) return
    if (!user) {
      router.replace(`/auth/signin?next=${encodeURIComponent(pathname || '/procurement')}`)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/procurement/organisation')
        const json = await res.json()
        if (cancelled) return
        if (res.status === 404) {
          setError('Organisation workspace is not enabled.')
          return
        }
        if (!res.ok && json?.code !== 'NO_ORG' && !json?.data?.needsOnboarding) {
          // GET may return soft onboarding payload
          if (json?.data?.needsOnboarding) {
            setNeedsOnboarding(true)
            setReady(true)
            return
          }
          setError(json?.error || 'Unable to load workspace')
          return
        }
        if (json?.data?.needsOnboarding || !json?.data?.organisation) {
          setNeedsOnboarding(true)
        }
        setReady(true)
      } catch {
        if (!cancelled) setError('Unable to load workspace')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, loading, router, pathname])

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-brand-950">Procurement workspace</h1>
        <p className="mt-3 text-sm text-slate-600">{error}</p>
        <Link href="/submit-tender" className="mt-6 inline-block text-sm font-semibold text-brand-800">
          Use public submit form
        </Link>
      </div>
    )
  }

  if (!ready || loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-600">
        Loading workspace…
      </div>
    )
  }

  if (needsOnboarding && pathname !== '/procurement/organisation') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-brand-950">Set up your organisation</h1>
        <p className="mt-3 text-sm text-slate-600">
          Create an organisation profile to manage private tender drafts and submissions.
        </p>
        <Link
          href="/procurement/organisation?onboarding=1"
          className="mt-6 inline-flex rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Create organisation
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Private sector
            </p>
            <Link href="/procurement" className="text-lg font-bold text-brand-950">
              Procurement workspace
            </Link>
          </div>
          <nav className="flex flex-wrap gap-1" aria-label="Procurement">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active ? 'bg-brand-50 text-brand-900' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
