import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { ArrowRight, MapPin, Star, TrendingUp, Wallet } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Youth Agents',
  description:
    'Join TenderBriefing as a Youth Agent — earn income attending compulsory government tender briefings on behalf of SMEs.',
}

const benefits = [
  {
    icon: Wallet,
    title: 'Earn through briefing attendance',
    text: 'Get paid for professional in-person attendance and quality reporting.',
  },
  {
    icon: MapPin,
    title: 'Opportunities near you',
    text: 'Receive notifications for briefings in your area when you are available.',
  },
  {
    icon: Star,
    title: 'Build your reputation',
    text: 'Ratings and completion history help you win more assignments over time.',
  },
  {
    icon: TrendingUp,
    title: 'Real procurement experience',
    text: 'Develop skills in government procurement while participating in the economy.',
  },
]

export default function YouthAgentsPage() {
  return (
    <MarketingPageLayout
      eyebrow="Youth Agents"
      title="Participate in South Africa's procurement economy"
      description="TenderBriefing empowers young professionals across South Africa to attend compulsory tender briefings on behalf of SMEs — creating income, experience, and nationwide impact."
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {benefits.map((b, i) => (
          <AnimateIn key={b.title} delay={i * 0.06}>
            <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
              <b.icon className="h-8 w-8 text-brand-600" />
              <h2 className="mt-4 text-xl font-bold text-slate-900">{b.title}</h2>
              <p className="mt-2 text-slate-600 leading-relaxed">{b.text}</p>
            </div>
          </AnimateIn>
        ))}
      </div>
      <div className="mt-12 text-center">
        <Link
          href="/auth/signup?type=youth-agent"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-4 font-semibold text-white hover:bg-brand-700"
        >
          Become a Youth Agent
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </MarketingPageLayout>
  )
}
