import type { Metadata } from 'next'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import WhatsAppIconLink from '@/components/ui/WhatsAppIconLink'
import ContactForm from '@/components/contact/ContactForm'
import {
  OFFICE_ADDRESS_LINES,
  OFFICE_EMAIL,
  OFFICE_EMAIL_HREF,
  OFFICE_LOCATION_SHORT,
  OFFICE_PHONE_DISPLAY,
  OFFICE_PHONE_HREF,
} from '@/lib/contact'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { Mail, MapPin, Phone } from 'lucide-react'

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact TenderBriefing',
  description:
    'Contact TenderBriefing at our Centurion office, by telephone, or by email. Questions about tender briefings, Youth Agents, or your account.',
  path: '/contact',
  keywords: [
    'contact TenderBriefing',
    'tender briefing support South Africa',
    'SME procurement support',
    'Centurion office',
  ],
})

export default function ContactPage() {
  return (
    <MarketingPageLayout
      eyebrow="Contact"
      title="Contact TenderBriefing"
      description="Questions about TenderBriefing, tender briefings or your account? Get in touch with our team."
    >
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:gap-12 lg:items-start">
        <AnimateIn>
          <div className="space-y-8">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-800">
                Office
              </h2>
              <div className="mt-4 flex gap-3">
                <MapPin
                  className="mt-0.5 h-5 w-5 shrink-0 text-accent-500"
                  aria-hidden
                />
                <address className="not-italic text-base leading-relaxed text-slate-800">
                  {OFFICE_ADDRESS_LINES.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            </section>

            <div className="h-px bg-brand-100" aria-hidden />

            <section>
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-800">
                Telephone
              </h2>
              <a
                href={OFFICE_PHONE_HREF}
                className="mt-3 inline-flex min-h-[44px] items-center gap-3 text-lg font-semibold text-brand-900 transition hover:text-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                <Phone className="h-5 w-5 shrink-0 text-accent-500" aria-hidden />
                {OFFICE_PHONE_DISPLAY}
              </a>
            </section>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-800">
                Email
              </h2>
              <a
                href={OFFICE_EMAIL_HREF}
                className="mt-3 inline-flex min-h-[44px] items-center gap-3 break-all text-lg font-semibold text-brand-900 transition hover:text-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                <Mail className="h-5 w-5 shrink-0 text-accent-500" aria-hidden />
                {OFFICE_EMAIL}
              </a>
            </section>

            <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 px-4 py-4">
              <WhatsAppIconLink />
              <div>
                <p className="text-sm font-medium text-slate-500">WhatsApp</p>
                <p className="font-semibold text-brand-900">Chat with us</p>
              </div>
            </div>
          </div>
        </AnimateIn>

        <AnimateIn delay={0.08}>
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-brand-800 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 px-6 py-8 text-white shadow-card sm:px-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-500/20 blur-3xl" />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
                  Our office
                </p>
                <p className="mt-3 font-display text-2xl font-bold leading-snug">
                  {OFFICE_LOCATION_SHORT}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-brand-100/85">
                  Byls Bridge Office Park · First Floor, Block B · Doringkloof
                </p>
                <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="text-brand-100/70">Telephone</dt>
                    <dd>
                      <a
                        href={OFFICE_PHONE_HREF}
                        className="font-semibold text-accent-300 transition hover:text-accent-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
                      >
                        {OFFICE_PHONE_DISPLAY}
                      </a>
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="text-brand-100/70">Email</dt>
                    <dd>
                      <a
                        href={OFFICE_EMAIL_HREF}
                        className="break-all font-semibold text-accent-300 transition hover:text-accent-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
                      >
                        {OFFICE_EMAIL}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <ContactForm />
          </div>
        </AnimateIn>
      </div>
    </MarketingPageLayout>
  )
}
