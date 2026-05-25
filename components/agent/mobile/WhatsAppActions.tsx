'use client'

import { MessageCircle, AlertTriangle, Truck } from 'lucide-react'
import { whatsAppLink } from '@/lib/mobile/constants'

export default function WhatsAppActions({
  requestId,
  tenderNumber,
}: {
  requestId?: string
  tenderNumber?: string
}) {
  const ctx = tenderNumber ? `Tender ${tenderNumber}` : requestId ? `Request ${requestId}` : 'Field ops'

  const actions = [
    {
      label: 'Support',
      icon: MessageCircle,
      href: whatsAppLink(`TenderBriefing field support — ${ctx}`),
    },
    {
      label: 'Dispatch backup',
      icon: Truck,
      href: whatsAppLink(`Dispatch backup needed — ${ctx}`),
    },
    {
      label: 'Escalation',
      icon: AlertTriangle,
      href: whatsAppLink(`Escalation — ${ctx}`),
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ label, icon: Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
        >
          <Icon className="h-4 w-4" />
          {label}
        </a>
      ))}
    </div>
  )
}
