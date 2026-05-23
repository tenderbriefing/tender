'use client'

import AnimateIn from '@/components/ui/AnimateIn'
import SectionHeading from '@/components/ui/SectionHeading'
import { FileCheck, MapPin, Search, Send, UserPlus } from 'lucide-react'

const steps = [
  {
    step: '01',
    icon: Search,
    title: 'SME identifies tender',
    description: 'Discover a government opportunity with a compulsory briefing or site meeting requirement.',
  },
  {
    step: '02',
    icon: UserPlus,
    title: 'SME requests Youth Agent',
    description: 'Submit an attendance request with location, date, and briefing details from your dashboard.',
  },
  {
    step: '03',
    icon: Send,
    title: 'Nearby agents notified',
    description: 'Qualified Youth Agents in the area receive the opportunity and can accept the assignment.',
  },
  {
    step: '04',
    icon: MapPin,
    title: 'Agent attends briefing',
    description: 'Your assigned agent attends in person, captures notes, and documents key compliance points.',
  },
  {
    step: '05',
    icon: FileCheck,
    title: 'SME receives briefing report',
    description: 'A structured briefing report is delivered so your team can prepare a compliant, informed bid.',
  },
]

export default function AttendanceProcess() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Process"
          title="How the Attendance Process Works"
          description="A clear, accountable workflow from tender discovery to briefing report — built for compliance and speed."
        />

        <div className="hidden lg:block relative">
          <div className="absolute left-0 right-0 top-16 h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200" />
          <div className="grid grid-cols-5 gap-4">
            {steps.map((s, i) => (
              <AnimateIn key={s.step} delay={i * 0.1}>
                <div className="relative text-center">
                  <div className="relative z-10 mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-2xl border-2 border-brand-100 bg-white shadow-card transition hover:border-brand-400">
                    <span className="absolute -top-3 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">
                      {s.step}
                    </span>
                    <s.icon className="h-8 w-8 text-brand-600" />
                  </div>
                  <h3 className="mt-6 text-base font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed px-2">{s.description}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:hidden">
          {steps.map((s, i) => (
            <AnimateIn key={s.step} delay={i * 0.05}>
              <div className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <s.icon className="h-7 w-7" />
                </div>
                <div>
                  <span className="text-xs font-bold text-brand-600">Step {s.step}</span>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.description}</p>
                </div>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  )
}
