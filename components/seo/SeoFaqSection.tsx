import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SectionLabel from '@/components/ui/SectionLabel'

export interface SeoFaqItem {
  question: string
  answer: string
}

export default function SeoFaqSection({
  title = 'Frequently asked questions',
  faqs,
}: {
  title?: string
  faqs: SeoFaqItem[]
}) {
  return (
    <section className="mt-16">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-6 space-y-4">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm open:shadow-md"
          >
            <summary className="cursor-pointer list-none text-base font-semibold text-brand-900">
              {faq.question}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function SeoCtaBand({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
}) {
  return (
    <section className="mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 px-6 py-10 text-white shadow-card sm:px-10">
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-brand-100/85">{description}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={primaryHref}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-brand-900 transition hover:bg-accent-400"
        >
          {primaryLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </section>
  )
}
