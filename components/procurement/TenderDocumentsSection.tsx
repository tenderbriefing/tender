import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { ExternalLink, FileText, File } from 'lucide-react'
import {
  collectTenderDocuments,
  countDownloadableDocuments,
} from '@/lib/procurement/tenderDocuments'

export default function TenderDocumentsSection({ tender }: { tender: TenderBriefing }) {
  const documentLinks = collectTenderDocuments(tender)
  const downloadableCount = countDownloadableDocuments(documentLinks)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-600" aria-hidden />
          Tender Documents
        </h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {documentLinks.length} {documentLinks.length === 1 ? 'link' : 'links'}
        </span>
      </div>

      {documentLinks.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No documents were attached in the official feed. Search for this tender number on
          etenders.gov.za or contact the procurement officer for the full document pack.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-600">
            {downloadableCount > 0
              ? `${downloadableCount} official ${downloadableCount === 1 ? 'document' : 'documents'} available for download.`
              : 'Use the eTenders portal link below for the full tender pack.'}
          </p>
          <ul className="mt-4 space-y-3">
            {documentLinks.map((doc) => (
              <li
                key={doc.url}
                className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <File className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                  <div className="min-w-0">
                    <span className="inline-block rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700">
                      {doc.kind}
                    </span>
                    <p className="mt-1 text-sm font-medium text-slate-800">{doc.title}</p>
                  </div>
                </div>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  {doc.source === 'portal' ? 'Open portal' : 'Download'}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
