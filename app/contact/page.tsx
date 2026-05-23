import type { Metadata } from 'next'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the TenderBriefing team for support, partnerships, and enterprise enquiries.',
}

export default function ContactPage() {
  return (
    <MarketingPageLayout
      eyebrow="Contact"
      title="We are here to support your procurement journey"
      description="Reach out for platform support, SME onboarding, Youth Agent verification, or enterprise partnerships."
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        <AnimateIn>
          <div className="space-y-6">
            {[
              { icon: Mail, label: 'Email', value: 'support@tenderbriefing.co.za' },
              { icon: Phone, label: 'Phone', value: '+27 10 013 3423' },
              { icon: MapPin, label: 'Office', value: 'Midrand, Gauteng, South Africa' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">{item.label}</p>
                  <p className="font-semibold text-slate-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimateIn>
        <AnimateIn delay={0.1}>
          <form className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-brand-700">
              <MessageSquare className="h-5 w-5" />
              <span className="font-semibold">Send a message</span>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="form-label">
                  Full name
                </label>
                <input id="name" name="name" type="text" className="form-input" required />
              </div>
              <div>
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input id="email" name="email" type="email" className="form-input" required />
              </div>
              <div>
                <label htmlFor="message" className="form-label">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="form-input"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
              >
                Submit enquiry
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              We typically respond within one business day.
            </p>
          </form>
        </AnimateIn>
      </div>
    </MarketingPageLayout>
  )
}
