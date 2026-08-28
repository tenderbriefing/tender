import type { Metadata } from 'next'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import WhatsAppIconLink from '@/components/ui/WhatsAppIconLink'
import ContactForm from '@/components/contact/ContactForm'
import { SUPPORT_EMAIL } from '@/lib/contact'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { Mail, MapPin } from 'lucide-react'

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact TenderBriefing',
  description:
    'Contact TenderBriefing for SME onboarding, Youth Agent verification, platform support, and enterprise partnerships across South Africa.',
  path: '/contact',
  keywords: [
    'contact TenderBriefing',
    'tender briefing support South Africa',
    'SME procurement support',
  ],
})

export default function ContactPage() {
  return (
    <MarketingPageLayout
      eyebrow="Contact"
      title="We are here to support your procurement journey"
      description="Reach out for platform support, SME onboarding, Youth Agent verification, or enterprise partnerships. We respond within 24 hours."
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        <AnimateIn>
          <div className="space-y-6">
            <div className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Email</p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-slate-900 hover:text-brand-700"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <WhatsAppIconLink />
              <div>
                <p className="text-sm font-medium text-slate-500">WhatsApp</p>
                <p className="font-semibold text-slate-900">Chat with us</p>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Office</p>
                <p className="font-semibold text-slate-900">Midrand, Gauteng, South Africa</p>
              </div>
            </div>
          </div>
        </AnimateIn>
        <AnimateIn delay={0.1}>
          <ContactForm />
        </AnimateIn>
      </div>
    </MarketingPageLayout>
  )
}
