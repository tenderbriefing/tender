import type { TenderBriefing, TenderBriefingDocument } from '@/lib/tenderBriefing/types'

export type TenderDocumentKind = 'PDF' | 'Image' | 'Word' | 'Excel' | 'Archive' | 'Portal' | 'Document'

export interface TenderDocumentLink {
  url: string
  title: string
  kind: TenderDocumentKind
  /** Direct download from eTenders vs portal listing page */
  source: 'attachment' | 'portal'
  datePublished?: string
}

export function tenderDocumentKind(url: string, format?: string | null): TenderDocumentKind {
  const lower = `${url} ${format || ''}`.toLowerCase()
  if (lower.includes('.pdf') || format === 'pdf') return 'PDF'
  if (/\.(jpg|jpeg|png|gif|webp)/.test(lower)) return 'Image'
  if (/\.(doc|docx)/.test(lower)) return 'Word'
  if (/\.(xls|xlsx)/.test(lower)) return 'Excel'
  if (/\.(zip|rar|7z)/.test(lower)) return 'Archive'
  return 'Document'
}

function portalLabel(tenderNumber?: string | null): string {
  return tenderNumber
    ? `View tender ${tenderNumber} on National Treasury eTenders`
    : 'View tender on National Treasury eTenders'
}

export function collectTenderDocuments(
  tender: Pick<TenderBriefing, 'documents' | 'detailUrl' | 'tenderNumber'>
): TenderDocumentLink[] {
  const links: TenderDocumentLink[] = []
  const seen = new Set<string>()

  const push = (link: TenderDocumentLink) => {
    const key = link.url.trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    links.push(link)
  }

  for (const doc of tender.documents || []) {
    const url = typeof doc === 'string' ? doc : doc.url
    if (!url) continue
    const meta = typeof doc === 'object' ? (doc as TenderBriefingDocument) : null
    push({
      url,
      title: meta?.title?.trim() || 'Official tender document',
      kind: tenderDocumentKind(url, meta?.format),
      source: 'attachment',
      datePublished: meta?.datePublished,
    })
  }

  if (tender.detailUrl) {
    push({
      url: tender.detailUrl,
      title: portalLabel(tender.tenderNumber),
      kind: 'Portal',
      source: 'portal',
    })
  }

  return links
}

export function countDownloadableDocuments(links: TenderDocumentLink[]): number {
  return links.filter((l) => l.source === 'attachment').length
}
