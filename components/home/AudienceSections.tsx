'use client'

import AnimateIn from '@/components/ui/AnimateIn'
import SectionHeading from '@/components/ui/SectionHeading'
import {
  Banknote,
  Bell,
  ClipboardList,
  Globe,
  LayoutDashboard,
  MapPin,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react'

const smeBenefits = [
  { icon: Banknote, title: 'Save travel costs', text: 'Attend briefings virtually through verified agents without costly trips.' },
  { icon: Bell, title: 'Never miss briefing deadlines', text: 'Automated alerts for compulsory sessions, site visits, and clarifications.' },
  { icon: ClipboardList, title: 'Access structured meeting reports', text: 'Receive consistent briefing documentation you can use in your bid.' },
  { icon: Globe, title: 'Request Youth Agents nationwide', text: 'Match attendance support across provinces from a single platform.' },
  { icon: LayoutDashboard, title: 'Track opportunities centrally', text: 'Monitor tenders, meetings, and agent requests in one dashboard.' },
]

const agentBenefits = [
  { icon: Wallet, title: 'Earn income through briefing attendance', text: 'Get paid for professional attendance and quality briefing reports.' },
  { icon: MapPin, title: 'Receive nearby opportunities', text: 'Get notified of briefings close to your location and availability.' },
  { icon: Star, title: 'Build reliability ratings', text: 'Grow your reputation with SME feedback and completion history.' },
  { icon: TrendingUp, title: 'Participate in the procurement economy', text: 'Gain real experience in government procurement while earning.' },
]

function BenefitCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Banknote
  title: string
  text: string
}) {
  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-card">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
    </div>
  )
}

export default function AudienceSections() {
  return (
    <section className="bg-slate-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div id="for-smes" className="scroll-mt-24">
          <SectionHeading
            eyebrow="For SMEs"
            title="Stay compliant without leaving your business behind"
            description="TenderBriefing scans official government procurement opportunities and identifies tenders that require compulsory briefing sessions, site inspections, or clarification meetings."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {smeBenefits.map((b, i) => (
              <AnimateIn key={b.title} delay={i * 0.05}>
                <BenefitCard {...b} />
              </AnimateIn>
            ))}
          </div>
        </div>

        <div id="for-youth-agents" className="mt-24 scroll-mt-24">
          <SectionHeading
            eyebrow="For Youth Agents"
            title="Turn procurement meetings into meaningful income"
            description="TenderBriefing empowers young professionals across South Africa to participate in the procurement economy by attending compulsory tender briefings on behalf of SMEs."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {agentBenefits.map((b, i) => (
              <AnimateIn key={b.title} delay={i * 0.05}>
                <BenefitCard {...b} />
              </AnimateIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
