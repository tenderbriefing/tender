'use client'

import Link from 'next/link'
import { FounderShell } from '@/components/founder/FounderShell'
import { FounderV2Gate } from '@/components/founder/v2/FounderV2Gate'
import { founderEmailAllowlist } from '@/lib/founder/access'

const LINKS = [
  {
    href: '/admin/dashboard',
    label: 'Operations console',
    description: 'Assignments, RFQ inbox, finance, integrations, and infrastructure.',
  },
  {
    href: '/founder/user-intelligence',
    label: 'User Intelligence',
    description: 'Previous founder engagement and geography view. Not part of primary navigation.',
  },
]

export default function FounderSettingsPage() {
  const allowlist = founderEmailAllowlist()

  return (
    <FounderV2Gate>
      <FounderShell
        title="Settings"
        subtitle="Founder workspace only — technical configuration stays in the operations console"
      >
        <div className="max-w-2xl space-y-8">
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-900">Access</h2>
            <p className="mt-2 text-sm text-slate-600">
              Founder data APIs stay on the existing allow-list. A signed-in HTML page is not
              authorization.
            </p>
            <p className="mt-3 text-sm text-brand-900">
              Allow-listed emails: {allowlist.join(', ')}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-brand-900">Elsewhere</h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">
              {LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block px-4 py-4 hover:bg-slate-50">
                    <p className="text-sm font-medium text-brand-900">{item.label}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </FounderShell>
    </FounderV2Gate>
  )
}
