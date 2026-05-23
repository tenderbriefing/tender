'use client'

import AnimateIn from '@/components/ui/AnimateIn'
import SectionHeading from '@/components/ui/SectionHeading'
import {
  Bot,
  Calendar,
  LayoutDashboard,
  Radar,
  Radio,
  Search,
  UserCheck,
} from 'lucide-react'

const features = [
  {
    icon: Search,
    title: 'Live Tender Briefing Discovery',
    description:
      'Browse government tenders with compulsory briefings, site meetings, and clarification sessions — updated from official procurement feeds.',
  },
  {
    icon: Radar,
    title: 'Smart Briefing Detection',
    description:
      'Automated classification flags tenders that require physical attendance so you never overlook a compliance requirement.',
  },
  {
    icon: LayoutDashboard,
    title: 'Opportunity Dashboard',
    description:
      'A single workspace for deadlines, provinces, scoring, and agent requests — designed for busy SME owners and bid teams.',
  },
  {
    icon: UserCheck,
    title: 'Youth Agent Attendance Requests',
    description:
      'Request verified agents to attend on your behalf with transparent status tracking from assignment to report delivery.',
  },
  {
    icon: Bot,
    title: 'AI-Powered Briefing Summaries',
    description:
      'Structured summaries highlight key requirements, dates, and risks from agent reports so you can decide faster.',
  },
  {
    icon: Calendar,
    title: 'Procurement Calendar Tracking',
    description:
      'Sync briefing dates, submission deadlines, and site visits into a calendar view built for tender workflows.',
  },
  {
    icon: Radio,
    title: 'Real-Time Updates',
    description:
      'Live sync from official data sources keeps your opportunity pipeline current without manual spreadsheet updates.',
  },
]

export default function PlatformFeatures() {
  return (
    <section id="features" className="scroll-mt-24 bg-slate-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Platform Features"
          title="Everything you need to stay briefing-ready"
          description="Enterprise-grade procurement tools designed for South African SMEs and the Youth Agents who support them."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <AnimateIn key={f.title} delay={i * 0.05}>
              <div className="group flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-card">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:scale-110 group-hover:bg-brand-600 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                  {f.description}
                </p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  )
}
