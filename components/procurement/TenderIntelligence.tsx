'use client'

import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  File,
  FileText,
  Info,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  countdownLabel,
  formatProcurementDate,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'

interface TenderIntelligenceProps {
  tender: TenderBriefing
}

function SectionHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint?: string
}) {
  return (
    <div className="mb-5">
      <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-800">
        <span className="h-1.5 w-6 rounded-full bg-accent-500" />
        {hint || 'Tender intelligence'}
      </span>
      <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-brand-900">
        <Icon className="h-5 w-5 text-accent-500" />
        {title}
      </h2>
    </div>
  )
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7 ${className}`}
    >
      {children}
    </section>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span>{text}</span>
    </div>
  )
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon
  label: string
  value?: string
  href?: string
}) {
  if (!value) return null
  const content = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-brand-900">{value}</p>
      </div>
    </div>
  )
  return href ? (
    <a
      href={href}
      className="block rounded-xl px-3 py-2 transition hover:bg-brand-50/60"
    >
      {content}
    </a>
  ) : (
    <div className="px-3 py-2">{content}</div>
  )
}

function docKind(url: string): string {
  const lower = url.toLowerCase()
  if (lower.endsWith('.pdf')) return 'PDF'
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return 'Image'
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'Word'
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'Excel'
  return 'Document'
}

function safeText(...candidates: Array<string | undefined | null>): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c
  }
  return null
}

export default function TenderIntelligence({ tender }: TenderIntelligenceProps) {
  const description = safeText(tender.description, tender.summary)
  const summary = safeText(tender.summary, tender.description)
  const closing = formatProcurementDate(tender.closingDate)
  const closingCountdown = countdownLabel(tender.closingDate)
  const briefingCountdown = countdownLabel(tender.briefingDate)
  const briefingDateTime = formatProcurementDateTime(
    tender.briefingDate,
    tender.briefingTime
  )

  const docs: string[] = []
  if (tender.detailUrl) docs.push(tender.detailUrl)
  const extra = (tender as { documentUrls?: string[] }).documentUrls
  if (Array.isArray(extra)) docs.push(...extra)
  const uniqueDocs = Array.from(new Set(docs.filter(Boolean)))

  const requirements = Array.isArray(tender.requirements) ? tender.requirements : []
  const risks = Array.isArray(tender.risks) ? tender.risks : []
  const keyDates = [
    tender.publishedDate
      ? {
          label: 'Published',
          value: formatProcurementDate(tender.publishedDate),
          tone: 'neutral' as const,
        }
      : null,
    tender.briefingDate
      ? {
          label: tender.briefingCompulsory ? 'Compulsory briefing' : 'Briefing session',
          value: briefingDateTime,
          tone: 'gold' as const,
          hint: briefingCountdown ? `${briefingCountdown} away` : undefined,
        }
      : null,
    tender.closingDate
      ? {
          label: 'Closing date',
          value: closing,
          tone: 'navy' as const,
          hint: closingCountdown ? `${closingCountdown} remaining` : undefined,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string
    value: string
    tone: 'neutral' | 'gold' | 'navy'
    hint?: string
  }>

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading icon={FileText} title="Opportunity overview" hint="Tender brief" />
        {summary ? (
          <p className="text-base leading-relaxed text-slate-700">{summary}</p>
        ) : (
          <EmptyHint text="No opportunity summary published yet — see the full description below or open the official tender notice." />
        )}

        {description && description !== summary && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Full description
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {description}
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
              Procurement method
            </p>
            <p className="mt-1.5 text-sm font-semibold text-brand-900">
              {tender.procurementMethod || 'Standard tender'}
            </p>
          </div>
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
              Category
            </p>
            <p className="mt-1.5 text-sm font-semibold text-brand-900">
              {tender.industrySector || tender.category || 'General procurement'}
            </p>
          </div>
          <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent-700">
              Source
            </p>
            <p className="mt-1.5 text-sm font-semibold text-brand-900">
              Official eTenders sync
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeading
          icon={Clock}
          title="Briefing & key dates"
          hint="Critical deadlines"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          {keyDates.length === 0 ? (
            <div className="sm:col-span-3">
              <EmptyHint text="Key dates have not been published yet — check back after the next sync." />
            </div>
          ) : (
            keyDates.map((d) => (
              <div
                key={d.label}
                className={`relative overflow-hidden rounded-2xl border p-4 ${
                  d.tone === 'gold'
                    ? 'border-accent-200 bg-gradient-to-br from-accent-50 to-white'
                    : d.tone === 'navy'
                      ? 'border-brand-200 bg-gradient-to-br from-brand-50 to-white'
                      : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-800">
                  {d.label}
                </p>
                <p className="mt-2 text-lg font-bold text-brand-900">{d.value}</p>
                {d.hint && (
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      d.tone === 'gold' ? 'text-accent-700' : 'text-brand-800'
                    }`}
                  >
                    {d.hint}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {(tender.briefingVenue || tender.meetingLink || tender.briefingDate) && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 ring-1 ring-inset ring-slate-100">
            <div className="grid gap-3 sm:grid-cols-2">
              {tender.briefingVenue && (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Briefing venue
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-brand-900">
                      {tender.briefingVenue}
                    </p>
                  </div>
                </div>
              )}
              {tender.meetingLink && (
                <a
                  href={tender.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl px-3 py-2 -mx-3 -my-2 transition hover:bg-brand-50/60"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700 ring-1 ring-inset ring-accent-200">
                    <Link2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Online meeting
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-accent-700">
                      Join virtual briefing
                    </p>
                  </div>
                </a>
              )}
              {tender.briefingCompulsory && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700 ring-1 ring-inset ring-accent-200">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-accent-700">
                      Attendance required
                    </p>
                    <p className="mt-0.5 text-sm text-brand-900">
                      Compulsory — submissions from non-attending bidders may be disqualified.
                      Request a Youth Agent if you cannot attend in person.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {(requirements.length > 0 || risks.length > 0) && (
        <Card>
          <SectionHeading
            icon={ShieldCheck}
            title="Requirements & risks"
            hint="Compliance"
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {requirements.length > 0 && (
              <div className="rounded-2xl bg-brand-50/50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-800">
                  Required documents
                </p>
                <ul className="mt-3 space-y-2 text-sm text-brand-900">
                  {requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-800 text-[10px] font-bold text-white">
                        ✓
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {risks.length > 0 && (
              <div className="rounded-2xl bg-accent-50/60 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent-700">
                  Risks to consider
                </p>
                <ul className="mt-3 space-y-2 text-sm text-brand-900">
                  {risks.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <SectionHeading icon={User} title="Contact details" hint="Procurement officer" />
        {tender.contactPerson || tender.contactEmail || tender.contactPhone ? (
          <div className="grid gap-1 sm:grid-cols-2">
            <ContactRow icon={User} label="Contact person" value={tender.contactPerson} />
            <ContactRow
              icon={Mail}
              label="Email"
              value={tender.contactEmail}
              href={tender.contactEmail ? `mailto:${tender.contactEmail}` : undefined}
            />
            <ContactRow
              icon={Phone}
              label="Telephone"
              value={tender.contactPhone}
              href={tender.contactPhone ? `tel:${tender.contactPhone}` : undefined}
            />
            <ContactRow icon={Building2} label="Issuing department" value={tender.department} />
          </div>
        ) : (
          <EmptyHint text="Contact details not published yet — use the official source link to reach the procurement officer." />
        )}
      </Card>

      <Card>
        <SectionHeading icon={File} title="Documents & sources" hint="Downloads" />
        {uniqueDocs.length === 0 ? (
          <EmptyHint text="No documents available in TenderBriefing. Tender documents are published on the official procurement portal — use the contact details above to request them." />
        ) : (
          <ul className="space-y-3">
            {uniqueDocs.map((url, i) => (
              <li
                key={url}
                className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-accent-400">
                    <File className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <span className="inline-block rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-800">
                      {docKind(url)}
                    </span>
                    <p className="mt-1 truncate text-sm font-semibold text-brand-900">
                      {i === 0 ? 'Official tender notice' : `Attachment ${i}`}
                    </p>
                    <p className="truncate text-xs text-slate-500">{url}</p>
                  </div>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
                >
                  Open
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeading
          icon={MessageSquare}
          title="What happens next"
          hint="Procurement journey"
        />
        <ol className="relative space-y-5 border-l-2 border-dashed border-brand-200 pl-7">
          {[
            'Review the briefing and closing dates above. Set a calendar reminder.',
            tender.briefingCompulsory
              ? 'If you cannot attend the compulsory briefing in person, request a verified Youth Agent for R249.'
              : 'Confirm whether attendance at the briefing is required for your bid.',
            'Prepare your compliance documents (CSD registration, tax clearance, BBBEE).',
            'Submit your tender response through the official government procurement portal.',
          ].map((step, idx) => (
            <li key={step} className="relative">
              <span className="absolute -left-[2.05rem] flex h-8 w-8 items-center justify-center rounded-xl bg-brand-900 text-xs font-bold text-accent-400 ring-4 ring-white">
                {idx + 1}
              </span>
              <p className="text-sm leading-relaxed text-brand-900">{step}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
