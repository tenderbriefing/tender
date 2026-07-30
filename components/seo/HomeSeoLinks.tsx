import Link from 'next/link'
import SectionLabel from '@/components/ui/SectionLabel'

const SEO_LINK_GROUPS = [
  {
    title: 'Tender briefing guides',
    links: [
      { href: '/tender-briefings-south-africa', label: 'Tender briefings South Africa' },
      { href: '/compulsory-tender-briefings', label: 'Compulsory tender briefings' },
      { href: '/tender-briefing-attendance', label: 'Briefing attendance' },
      { href: '/resources', label: 'Resources & articles' },
    ],
  },
  {
    title: 'Services',
    links: [
      { href: '/tender-briefing-agent', label: 'Tender briefing agent' },
      { href: '/youth-agent-tender-support', label: 'Youth agent support' },
      { href: '/rfq-briefing-support', label: 'RFQ briefing support' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Browse by region & sector',
    links: [
      { href: '/tenders/gauteng', label: 'Gauteng tenders' },
      { href: '/tenders/western-cape', label: 'Western Cape tenders' },
      { href: '/tenders/construction', label: 'Construction tenders' },
      { href: '/tenders/ict', label: 'ICT tenders' },
    ],
  },
]

export default function HomeSeoLinks() {
  return (
    <section className="border-t border-slate-100 bg-slate-50/40 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionLabel>Explore</SectionLabel>
        <div className="mt-6 grid gap-8 md:grid-cols-3">
          {SEO_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </h2>
              <ul className="mt-3 space-y-1.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition hover:text-brand-800"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
