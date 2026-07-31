'use client'

import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Building2,
  ExternalLink,
  File,
  Info,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Clock,
  User,
} from 'lucide-react'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  countdownLabel,
  formatProcurementDate,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'
import { deriveTenderDescription } from '@/lib/procurement/tenderDescription'
import {
  collectTenderDocuments,
  countDownloadableDocuments,
} from '@/lib/procurement/tenderDocuments'

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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brand-900">{value}</p>
    </div>
  )
}

export default function TenderIntelligence({ tender }: TenderIntelligenceProps) {
  const derived = deriveTenderDescription(tender)
  const closing = formatProcurementDate(tender.closingDate)
  const closingCountdown = countdownLabel(tender.closingDate)
  const briefingCountdown = countdownLabel(tender.briefingDate)
  const briefingDateTime = formatProcurementDateTime(
    tender.briefingDate,
    tender.briefingTime
  )

  const documentLinks = collectTenderDocuments(tender)
  const downloadableCount = countDownloadableDocuments(documentLinks)

  const requirements = Array.isArray(tender.requirements) ? tender.requirements : []
  const risks = Array.isArray(tender.risks) ? tender.risks : []

  // Extra narrative only when it adds something the hero title does not already say.
  const supplementaryCopy =
    tender.summary &&
    tender.summary.trim() &&
    tender.summary.trim() !== derived.officialScope.trim() &&
    tender.summary.trim() !== (tender.title || '').trim()
      ? tender.summary.trim()
      : null

  const category =
    tender.industrySector || tender.category || 'General procurement'
  const method = tender.procurementMethod || 'Standard tender'

  const hasContact =
    Boolean(tender.contactPerson) ||
    Boolean(tender.contactEmail) ||
    Boolean(tender.contactPhone)

  const hasVenueOrMeeting = Boolean(tender.briefingVenue || tender.meetingLink)

  return (
    <div className="space-y-6">
      {/* 1. Dates & venue — operational truth, shown once */}
      <Card>
        <SectionHeading
          icon={Clock}
          title="Key dates & venue"
          hint="Plan attendance"
        />

        <div
          className={`grid gap-3 ${
            tender.publishedDate ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
          }`}
        >
          {tender.publishedDate && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-800">
                Published
              </p>
              <p className="mt-2 text-lg font-bold text-brand-900">
                {formatProcurementDate(tender.publishedDate)}
              </p>
            </div>
          )}

          <div
            className={`rounded-2xl border p-4 ${
              tender.briefingDate
                ? 'border-accent-200 bg-gradient-to-br from-accent-50 to-white'
                : 'border-dashed border-slate-200 bg-slate-50/60'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent-700">
              {tender.briefingCompulsory ? 'Compulsory briefing' : 'Briefing session'}
            </p>
            <p className="mt-2 text-lg font-bold text-brand-900">
              {tender.briefingDate ? briefingDateTime : 'To be confirmed'}
            </p>
            {briefingCountdown && (
              <p className="mt-1 text-xs font-semibold text-accent-700">
                {briefingCountdown} away
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-800">
              Closing date
            </p>
            <p className="mt-2 text-lg font-bold text-brand-900">
              {closing || 'To be confirmed'}
            </p>
            {closingCountdown && (
              <p className="mt-1 text-xs font-semibold text-brand-800">
                {closingCountdown} remaining
              </p>
            )}
          </div>
        </div>

        {(hasVenueOrMeeting || tender.briefingCompulsory) && (
          <div className="mt-5 space-y-3">
            {tender.briefingVenue && (
              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Briefing venue
                  </p>
                  <p className="mt-0.5 text-sm font-semibold leading-relaxed text-brand-900">
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
                className="flex items-start gap-3 rounded-2xl border border-accent-100 bg-accent-50/40 px-4 py-3.5 transition hover:border-accent-200"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700 ring-1 ring-inset ring-accent-200">
                  <Link2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Online meeting
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-accent-700">
                    Join virtual briefing
                  </p>
                </div>
              </a>
            )}

            {tender.briefingCompulsory && (
              <div className="flex items-start gap-3 rounded-2xl border border-accent-200 bg-accent-50/70 px-4 py-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700 ring-1 ring-inset ring-accent-200">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent-700">
                    Attendance required
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-brand-900">
                    Compulsory — submissions from non-attending bidders may be disqualified.
                    Request a Youth Agent if you cannot attend in person.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 2. Documents — act next */}
      <Card>
        <SectionHeading icon={File} title="Documents & sources" hint="Download" />
        {documentLinks.length === 0 ? (
          <EmptyHint text="No documents were attached in the official feed. Contact the procurement officer below or search for this tender number on etenders.gov.za." />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              {downloadableCount > 0
                ? `${downloadableCount} official ${downloadableCount === 1 ? 'document' : 'documents'} from National Treasury eTenders — opens in a new tab.`
                : 'Open the eTenders portal listing below for the full tender pack and attachments.'}
            </p>
            <ul className="space-y-3">
              {documentLinks.map((doc) => (
                <li
                  key={doc.url}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        doc.source === 'portal'
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-brand-900 text-accent-400'
                      }`}
                    >
                      <File className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <span className="inline-block rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-800">
                        {doc.kind}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-brand-900">{doc.title}</p>
                    </div>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
                  >
                    {doc.source === 'portal' ? 'Open portal' : 'Download'}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* 3. Contact */}
      <Card>
        <SectionHeading icon={User} title="Procurement contact" hint="Ask questions" />
        {hasContact ? (
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
          <EmptyHint text="Contact details not published yet — use the official eTenders portal link above to reach the procurement officer." />
        )}
      </Card>

      {/* 4. Requirements / risks when present */}
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

      {/* 5. Lean facts — only once, no title/date repeats */}
      <Card>
        <SectionHeading
          icon={Info}
          title="Tender facts"
          hint="At a glance"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Fact label="Procurement method" value={method} />
          <Fact label="Category" value={category} />
          <Fact label="Source" value="Official eTenders sync" />
        </div>

        {supplementaryCopy && (
          <p className="mt-5 text-sm leading-relaxed text-slate-700">{supplementaryCopy}</p>
        )}

        {derived.isFallback && (
          <div className="mt-5">
            <EmptyHint text="Download the tender document above or open the eTenders portal for the full scope of work." />
          </div>
        )}
      </Card>

      {/* 6. Journey last */}
      <Card>
        <SectionHeading
          icon={MessageSquare}
          title="What happens next"
          hint="Suggested path"
        />
        <ol className="mt-1">
          {[
            'Confirm the briefing and closing dates above, then add the briefing to your calendar.',
            tender.briefingCompulsory
              ? 'If you cannot attend the compulsory briefing in person, request a verified Youth Agent for R249.'
              : 'Confirm whether attendance at the briefing is required for your bid.',
            'Download the tender documents and prepare compliance packs (CSD, tax clearance, BBBEE).',
            'Submit your response through the official government procurement portal — not through TenderBriefing.',
          ].map((step, idx, steps) => {
            const isLast = idx === steps.length - 1
            return (
              <li key={step} className="relative flex gap-4">
                <div className="relative flex w-9 shrink-0 flex-col items-center">
                  <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-900 text-sm font-bold tabular-nums text-accent-400 shadow-soft">
                    {idx + 1}
                  </span>
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="absolute top-9 bottom-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-brand-300 via-brand-200 to-brand-100"
                    />
                  ) : null}
                </div>
                <p
                  className={`min-w-0 flex-1 pt-2 text-sm leading-relaxed text-brand-900 ${
                    isLast ? 'pb-0' : 'pb-7'
                  }`}
                >
                  {step}
                </p>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
