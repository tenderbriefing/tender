import type { Metadata } from 'next'
import Link from 'next/link'
import { FileSearch } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import EmptyState from '@/components/ui/EmptyState'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Page not found',
  description: 'The page you requested could not be found on TenderBriefing.',
  noIndex: true,
})

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={FileSearch}
          title="Page not found"
          description="The link may be incorrect or the page may have been removed. Browse live tender opportunities or return home."
          action={{ label: 'Browse tender opportunities', href: '/tenders' }}
        />
        <p className="mt-6 text-center text-sm text-slate-500">
          Or{' '}
          <Link href="/" className="font-semibold text-brand-800 hover:underline">
            return home
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  )
}
