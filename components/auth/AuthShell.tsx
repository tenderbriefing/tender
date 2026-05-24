import Link from 'next/link'
import { TrustStrip } from '@/components/procurement/TrustDisclaimer'

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12 sm:px-6">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <span className="text-lg font-bold text-white">TB</span>
          </div>
          <span className="text-xl font-bold text-slate-900">
            Tender<span className="text-brand-600">Briefing</span>
          </span>
        </Link>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-brand-600 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          </div>
          {children}
        </div>

        <div className="mt-6">
          <TrustStrip className="justify-center" />
        </div>
      </div>
    </div>
  )
}
