import type { Firestore } from 'firebase-admin/firestore'
import { collectTenderDocuments } from '@/lib/procurement/tenderDocuments'

const MAX_CHARS = 60_000

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse is CJS
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text?: string }>
    const parsed = await pdfParse(buffer)
    return String(parsed.text || '').slice(0, MAX_CHARS)
  } catch {
    return buffer
      .toString('latin1')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, Math.min(MAX_CHARS, 50_000))
  }
}

export type TenderDocumentTextResult = {
  text: string
  sourceUrls: string[]
  truncated: boolean
}

/**
 * Load official tender document text for comparison with the briefing transcript.
 * Prefer PDF attachments from tenderBriefings; fall back to Firestore description fields.
 */
export async function loadTenderDocumentText(params: {
  db: Firestore
  tenderId: string
}): Promise<TenderDocumentTextResult> {
  const snap = await params.db.collection('tenderBriefings').doc(params.tenderId).get()
  if (!snap.exists) {
    return { text: '', sourceUrls: [], truncated: false }
  }
  const tender = snap.data() as any
  const metaParts = [
    tender?.title || tender?.tenderTitle,
    tender?.tenderNumber || tender?.tenderReference,
    tender?.department || tender?.issuer,
    tender?.description || tender?.detail || tender?.summary,
    tender?.closingDate ? `Closing date: ${tender.closingDate}` : null,
    tender?.closingTime ? `Closing time: ${tender.closingTime}` : null,
    tender?.briefingDate ? `Briefing date: ${tender.briefingDate}` : null,
    tender?.briefingVenue ? `Briefing venue: ${tender.briefingVenue}` : null,
  ]
    .filter(Boolean)
    .map(String)

  const links = collectTenderDocuments({
    documents: tender?.documents || [],
    detailUrl: tender?.detailUrl || null,
    tenderNumber: tender?.tenderNumber || null,
  })

  const pdfLinks = links.filter((l) => l.kind === 'PDF' && l.source === 'attachment').slice(0, 2)
  const chunks: string[] = [...metaParts]
  const sourceUrls: string[] = []

  for (const link of pdfLinks) {
    try {
      const res = await fetch(link.url, {
        signal: AbortSignal.timeout(25_000),
        headers: { 'User-Agent': 'TenderBriefing/1.0' },
      })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 100) continue
      const text = await extractPdfText(buf)
      if (text.trim().length > 80) {
        chunks.push(`--- Document: ${link.title} ---\n${text}`)
        sourceUrls.push(link.url)
      }
    } catch {
      // Non-fatal: metadata still available
    }
  }

  const combined = chunks.join('\n\n').trim()
  const truncated = combined.length >= MAX_CHARS
  return {
    text: combined.slice(0, MAX_CHARS),
    sourceUrls,
    truncated,
  }
}
