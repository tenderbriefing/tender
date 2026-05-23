import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { ExternalLink, FileText, File } from 'lucide-react'

function fileBadge(url: string) {
  const lower = url.toLowerCase()
  if (lower.endsWith('.pdf')) return 'PDF'
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'Image'
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'Word'
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'Excel'
  return 'Document'
}

export default function TenderDocumentsSection({ tender }: { tender: TenderBriefing }) {
  const docs: string[] = []
  if (tender.detailUrl) docs.push(tender.detailUrl)
  const extra = (tender as { documentUrls?: string[] }).documentUrls
  if (Array.isArray(extra)) docs.push(...extra)

  const unique = Array.from(new Set(docs.filter(Boolean)))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-600" aria-hidden />
          Tender Documents
        </h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {unique.length} {unique.length === 1 ? 'link' : 'links'}
        </span>
      </div>

      {unique.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No documents available in TenderBriefing. Tender documents are published on the
          official procurement portal — use the department notice for downloads.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {unique.map((url, i) => (
            <li
              key={url}
              className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3 min-w-0">
                <File className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                <div className="min-w-0">
                  <span className="inline-block rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700">
                    {fileBadge(url)}
                  </span>
                  <p className="mt-1 truncate text-sm font-medium text-slate-800">
                    {i === 0 ? 'Official tender notice' : `Attachment ${i}`}
                  </p>
                </div>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Open
                <ExternalLink className="h-4 w-4" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
