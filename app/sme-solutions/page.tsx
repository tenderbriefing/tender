import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { ArrowRight, Bell, FileText, LayoutDashboard, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'SME Solutions',
  description:
    'TenderBriefing helps South African SMEs discover compulsory tender briefings and coordinate Youth Agent attendance nationwide.',
}

const solutions = [
  {
    icon: Bell,
    title: 'Briefing deadline intelligence',
    text: 'Never miss a compulsory session with alerts tied to official tender releases.',
  },
  {
    icon: Users,
    title: 'Nationwide agent coordination',
    text: 'Request verified Youth Agents to attend briefings anywhere in South Africa.',
  },
  {
    icon: FileText,
    title: 'Professional briefing reports',
    text: 'Receive structured documentation you can use in compliance and bid preparation.',
  },
  {
    icon: LayoutDashboard,
    title: 'Central opportunity control',
    text: 'Manage tenders, meetings, and agent requests from one procurement dashboard.',
  },
]

export default function SmeSolutionsPage() {
  return (
    <MarketingPageLayout
      eyebrow="SME Solutions"
      title="Procurement intelligence built for South African SMEs"
      description="TenderBriefing scans official government procurement opportunities and identifies tenders that require compulsory briefing sessions, site inspections, or clarification meetings — so your team can focus on winning work, not missing meetings."
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {solutions.map((s, i) => (
          <AnimateIn key={s.title} delay={i * 0.06}>
            <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
              <s.icon className="h-8 w-8 text-brand-600" />
              <h2 className="mt-4 text-xl font-bold text-slate-900">{s.title}</h2>
              <p className="mt-2 text-slate-600 leading-relaxed">{s.text}</p>
            </div>
          </AnimateIn>
        ))}
      </div>
      <div className="mt-12 text-center">
        <Link
          href="/auth/signup?type=sme"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-4 font-semibold text-white hover:bg-brand-700"
        >
          Start as an SME
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </MarketingPageLayout>
  )
}
