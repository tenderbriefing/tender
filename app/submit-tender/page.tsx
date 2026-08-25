import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import PrivateTenderSubmitForm from '@/components/privateTenders/PrivateTenderSubmitForm'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: 'Publish a Private Tender',
    description:
      'Private companies can publish procurement opportunities with compulsory briefing sessions and reach SMEs through TenderBriefing.',
    path: '/submit-tender',
  }),
  robots: { index: false, follow: false },
}

export default function SubmitPrivateTenderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">
          Private sector publishing
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-950 sm:text-4xl">
          Publish a Private Tender
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Private companies can publish procurement opportunities with compulsory briefing sessions
          and reach SMEs through TenderBriefing.
        </p>

        <ul className="mt-6 space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
          <li>Listing is subject to Founder verification.</li>
          <li>Submission does not guarantee publication.</li>
          <li>TenderBriefing does not manage your procurement evaluation or award.</li>
          <li>Your company remains responsible for its tender process and documents.</li>
          <li>TenderBriefing facilitates discovery and compulsory briefing attendance (R349).</li>
        </ul>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <PrivateTenderSubmitForm />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          TenderBriefing publishes private opportunities supplied by third parties. Bidders must
          verify requirements from the official tender document. Verification does not constitute
          financial or legal endorsement of the publisher.{' '}
          <Link href="/tenders" className="font-semibold text-brand-800 hover:underline">
            Browse opportunities
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  )
}
