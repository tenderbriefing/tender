/**
 * Future email ingestion — rfq@tenderbriefing.co.za forwarded tenders.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const briefingDetection = require('../ai/briefingDetectionService')
const pdfExtraction = require('../ai/procurementPdfExtractionService')

const COLLECTION = 'ingestedProcurementEmails'

function parseEmailPayload(payload = {}) {
  const body = `${payload.subject || ''}\n${payload.text || ''}\n${payload.html || ''}`
  const briefing = briefingDetection.detectBriefing(body)
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : []

  return {
    from: payload.from || null,
    subject: payload.subject || '',
    receivedAt: payload.receivedAt || new Date().toISOString(),
    bodyPreview: body.slice(0, 2000),
    attachmentCount: attachments.length,
    briefing,
    normalizedTender: {
      source: 'email_ingestion',
      tenderNumber: payload.reference || `email-${Date.now()}`,
      title: payload.subject || 'Forwarded tender email',
      description: body.slice(0, 4000),
      department: payload.department || null,
      province: payload.province || null,
      closingDate: briefing.extractedDate,
      briefingDate: briefing.extractedDate,
      briefingVenue: briefing.extractedVenue,
      compulsoryBriefing: briefing.compulsoryBriefing,
      attachments: attachments.map((a) => ({ name: a.name, url: a.url, type: a.type })),
    },
    status: 'parsed',
  }
}

async function ingestEmail(payload) {
  const db = getFirestore()
  const parsed = parseEmailPayload(payload)

  for (const att of payload.attachments || []) {
    if (att.url && String(att.url).toLowerCase().includes('.pdf')) {
      try {
        const extracted = await pdfExtraction.extractFromUrl(att.url, {
          source: 'email_attachment',
          docId: `email-pdf-${Date.now()}`,
        })
        if (extracted.ok && extracted.data) {
          parsed.pdfExtraction = extracted.data
          if (extracted.data.briefingDate) parsed.normalizedTender.briefingDate = extracted.data.briefingDate
          if (extracted.data.briefingVenue) parsed.normalizedTender.briefingVenue = extracted.data.briefingVenue
        }
      } catch {
        /* non-blocking */
      }
    }
  }

  const ref = db.collection(COLLECTION).doc()
  const doc = sanitizeFirestoreData({ id: ref.id, ...parsed, createdAt: new Date().toISOString() })
  await ref.set(doc)
  return doc
}

async function listRecent(limit = 20) {
  const db = getFirestore()
  const snap = await db.collection(COLLECTION).limit(limit).get().catch(() => ({ docs: [] }))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

module.exports = {
  COLLECTION,
  parseEmailPayload,
  ingestEmail,
  listRecent,
}
