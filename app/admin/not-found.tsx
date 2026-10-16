import type { Metadata } from 'next'
import Link from 'next/link'
import { FileSearch } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import EmptyState from '@/components/ui/EmptyState'
import { PRIVATE_ROUTE_ROBOTS } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_ROBOTS,
  title: 'Page not found | Admin',
}

/** Admin-scoped 404 — recover to Operations, not the public tender catalogue. */
export default function AdminNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={FileSearch}
          title="Page not found"
          description="That admin link is missing or incomplete. Open the Operations board to continue fulfilment."
          action={{ label: 'Open Operations board', href: '/admin/operations' }}
        />
        <p className="mt-6 text-center text-sm text-slate-500">
          Or{' '}
          <Link href="/admin/dashboard" className="font-semibold text-brand-800 hover:underline">
            return to admin dashboard
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  )
}
