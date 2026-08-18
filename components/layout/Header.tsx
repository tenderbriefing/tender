'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { toast } from 'react-hot-toast'
import { Menu, X } from 'lucide-react'
import NotificationCenter from '@/components/notifications/NotificationCenter'
import {
  AGENT_NAV,
  PUBLIC_NAV,
  SME_NAV,
  adminNavForUser,
  homePathForProfile,
} from '@/lib/auth/redirects'
import {
  evaluateFounderAccess,
  isFounderIntelligenceEnabledClient,
} from '@/lib/founder/access'

function isActive(pathname: string, href: string) {
  if (href === '/' || href === '/founder') return pathname === href
  if (href.startsWith('/#')) return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

const Header = ({ transparentOnHome = false }: { transparentOnHome?: boolean }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user, userProfile, loading } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      toast.success('Signed out successfully')
      setIsProfileOpen(false)
    } catch {
      toast.error('Error signing out')
    }
  }

  const dashboardHref = homePathForProfile(userProfile)
  const showFounderNav = evaluateFounderAccess({
    enabled: isFounderIntelligenceEnabledClient(),
    authenticated: Boolean(user),
    userType: userProfile?.userType,
    email: user?.email || userProfile?.email,
    founderAccess: userProfile?.founderAccess === true,
  }).ok

  const roleNav =
    userProfile?.userType === 'sme'
      ? SME_NAV
      : userProfile?.userType === 'youth-agent'
        ? AGENT_NAV
        : userProfile?.userType === 'admin'
          ? adminNavForUser({ showFounder: showFounderNav })
          : []

  // While auth is loading, keep public wayfinding visible — only swap chrome after resolve
  const showAccountChrome = !loading && !!user
  const showStandaloneDashboard =
    showAccountChrome && userProfile?.userType !== 'admin'
  const navItems = showAccountChrome ? roleNav : PUBLIC_NAV
  const onHomeOverlay = transparentOnHome && pathname === '/'
  const overDarkHero = onHomeOverlay && !scrolled && !isMenuOpen

  return (
    <header
      className={`z-50 border-b transition-all duration-300 ${
        onHomeOverlay ? 'fixed inset-x-0 top-0' : 'sticky top-0'
      } ${
        overDarkHero
          ? 'border-transparent bg-transparent'
          : scrolled || isMenuOpen
            ? 'border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl'
            : 'border-transparent bg-white/90 backdrop-blur-xl'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-[72px]">
          <Link href="/" className="group flex items-center" aria-label="TenderBriefing home">
            <Image
              src="/brand/logo.png"
              alt="TenderBriefing"
              width={192}
              height={128}
              priority
              unoptimized
              className="h-10 w-auto transition group-hover:opacity-90 sm:h-12"
            />
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    overDarkHero
                      ? active
                        ? 'bg-white/10 text-white'
                        : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
                      : active
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-brand-700'
                  }`}
                >
                  {item.name}
                </Link>
              )
            })}
            {showStandaloneDashboard && (
              <Link
                href={dashboardHref}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  overDarkHero
                    ? isActive(pathname, dashboardHref)
                      ? 'bg-white/10 text-white'
                      : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
                    : isActive(pathname, dashboardHref)
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-brand-700'
                }`}
              >
                Dashboard
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {showAccountChrome && <NotificationCenter />}
            {showAccountChrome ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium ${
                    overDarkHero
                      ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-800 text-xs font-bold text-white">
                    {(userProfile?.displayName || user?.email)?.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden md:inline max-w-[120px] truncate">
                    {userProfile?.displayName || 'Account'}
                  </span>
                </button>
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-100 bg-white py-2 shadow-card">
                    <Link
                      href={dashboardHref}
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-brand-50"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-brand-50"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className={`hidden sm:inline-flex rounded-lg px-4 py-2 text-sm font-semibold ${
                    overDarkHero
                      ? 'text-white hover:bg-white/10'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/role-selection"
                  className={`inline-flex rounded-xl px-3.5 py-2 text-sm font-semibold shadow-soft sm:px-4 sm:py-2.5 ${
                    overDarkHero
                      ? 'bg-accent-500 text-brand-950 hover:bg-accent-400'
                      : 'bg-brand-800 text-white hover:bg-brand-700'
                  }`}
                >
                  Start free
                </Link>
              </>
            )}

            <button
              type="button"
              className={`inline-flex rounded-lg p-2 lg:hidden ${
                overDarkHero
                  ? 'text-white hover:bg-white/10'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <nav className="border-t border-slate-100 bg-white py-4 lg:hidden" aria-label="Mobile">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`rounded-lg px-3 py-2.5 text-base font-medium ${
                    isActive(pathname, item.href)
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              {showStandaloneDashboard && (
                <Link
                  href={dashboardHref}
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
              )}
              {!showAccountChrome && (
                <>
                  <Link
                    href="/auth/signin"
                    className="rounded-lg px-3 py-2.5 font-medium text-slate-700"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/role-selection"
                    className="mx-3 mt-2 rounded-xl bg-brand-800 py-3 text-center font-semibold text-white"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Start free
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}

export default Header
