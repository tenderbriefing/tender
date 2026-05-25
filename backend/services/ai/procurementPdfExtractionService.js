/**
 * PDF procurement extraction — regex + optional OpenAI enrichment.
 */
const { persistInsight, nowIso } = require('./_shared')
const briefingDetection = require('./briefingDetectionService')

const CIDB_PATTERN = /CIDB\s*(?:grade|grading)?\s*[:\s]*(\d+[A-Z]?)/i
const CONTACT_PATTERN = /(?:contact|enquiries?)[:\s]+([^\n\r]{8,120})/i
const CLOSING_PATTERN = /(?:closing|submission)\s+date[:\s]+([^\n\r.]{6,40})/i

async function extractPdfText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return ''
  try {
    const pdfParse = require('pdf-parse')
    const parsed = await pdfParse(buffer)
    return String(parsed.text || '').slice(0, 80000)
  } catch {
    return buffer
      .toString('latin1')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 50000)
  }
}

function extractFieldsFromText(text = '') {
  const briefing = briefingDetection.detectBriefing(text)
  const cidb = text.match(CIDB_PATTERN)
  const contact = text.match(CONTACT_PATTERN)
  const closing = text.match(CLOSING_PATTERN)

  return {
    briefingDate: briefing.extractedDate,
    briefingVenue: briefing.extractedVenue,
    compulsoryBriefing: briefing.compulsoryBriefing,
    detectedBriefing: briefing.detectedBriefing,
    briefingConfidence: briefing.confidence,
    cidbGrade: cidb ? cidb[1] : null,
    contactPerson: contact ? contact[1].trim() : null,
    closingDate: closing ? closing[1].trim() : null,
    scope: text.slice(0, 500),
    submissionRequirements: /submit.*(?:documents|proposal|bid)/i.test(text)
      ? 'Submission requirements referenced in document'
      : null,
    extractedAt: nowIso(),
  }
}

async function enrichWithOpenAi(fields, text) {
  try {
    const openai = require('../integrations/openaiService')
    const result = await openai.summarizeTender({
      title: 'Procurement PDF',
      description: text.slice(0, 4000),
      department: fields.contactPerson || '',
    })
    if (result.ok && result.summary) {
      return {
        ...fields,
        aiSummary: result.summary,
        aiProvider: result.provider || 'openai',
      }
    }
  } catch {
    /* optional enhancement */
  }
  return fields
}

async function extractFromPdfBuffer(buffer, meta = {}) {
  const text = await extractPdfText(buffer)
  let fields = extractFieldsFromText(text)
  if (process.env.OPENAI_API_KEY && text.length > 200) {
    fields = await enrichWithOpenAi(fields, text)
  }

  const docId = meta.docId || `pdf-${Date.now()}`
  const record = {
    ...fields,
    tenderId: meta.tenderId || null,
    source: meta.source || 'pdf_extraction',
    pdfUrl: meta.pdfUrl || null,
    textLength: text.length,
  }

  await persistInsight('aiProcurementExtraction', docId, record)
  return { id: docId, ...record, textPreview: text.slice(0, 400) }
}

async function extractFromUrl(pdfUrl, meta = {}) {
  try {
    const res = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'TenderBriefing/1.0' },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, pdfUrl }
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    const data = await extractFromPdfBuffer(buffer, { ...meta, pdfUrl })
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'fetch_failed', pdfUrl }
  }
}

module.exports = {
  extractPdfText,
  extractFieldsFromText,
  extractFromPdfBuffer,
  extractFromUrl,
}
