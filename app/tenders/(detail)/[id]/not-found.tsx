import Link from 'next/link'
import { FileSearch } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import EmptyState from '@/components/ui/EmptyState'

export default function TenderNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={FileSearch}
          title="Tender opportunity not found"
          description="It may have been removed from the official feed or the link may be incorrect. Browse all live opportunities to keep going."
          action={{ label: 'Back to Tender Opportunities', href: '/tenders' }}
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
