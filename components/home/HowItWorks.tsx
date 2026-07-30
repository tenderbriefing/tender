'use client'

import { motion } from 'framer-motion'

const steps = [
  {
    word: 'Find',
    title: 'Compulsory briefings, surfaced',
    text: 'Browse live government tenders that require briefing attendance — filtered from official procurement data.',
  },
  {
    word: 'Track',
    title: 'Deadlines in one place',
    text: 'Keep venues, closing dates, and requirements organised so your bid team stays ahead of the calendar.',
  },
  {
    word: 'Win',
    title: 'Attend without the travel',
    text: 'Request a verified Youth Agent to attend on your behalf and return a structured briefing report.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-accent-600">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">
            Three moves. One outcome.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Built for SMEs who need compulsory briefings covered — without the logistics.
          </p>
        </div>

        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step, i) => (
            <motion.li
              key={step.word}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative text-center md:text-left"
            >
              <span className="font-display text-5xl font-semibold tracking-tight text-brand-900/10 sm:text-6xl">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.28em] text-accent-600">
                {step.word}
              </p>
              <h3 className="mt-3 font-display text-xl font-semibold text-brand-900">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                {step.text}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
