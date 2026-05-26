/**
 * RFQ inbox — forwarded email ingestion, AI extraction, private opportunity conversion.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const briefingDetection = require('../ai/briefingDetectionService')
const pdfExtraction = require('../ai/procurementPdfExtractionService')
const procurementDedup = require('./deduplicationService')
const { createEmptyTenderBriefing } = require('../tenderModel')
const { getStorage } = require('../storageAdapter')

const COLLECTION = 'ingestedProcurementEmails'

const REQUIRED_DISPATCH_FIELDS = [
  'title',
  'briefingDate',
  'briefingVenue',
  'province',
]

function normalizeEmailBody(payload = {}) {
  return [
    payload.rawEmailText,
    payload.text,
    payload.body,
    payload.html,
    payload.subject,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function ruleBasedExtraction(text, subject = '') {
  const briefing = briefingDetection.detectBriefing(text)
  const tenderMatch = text.match(/(?:tender|bid|rfq|reference)[:\s#]*([A-Z0-9\-\/]+)/i)
  const deptMatch = text.match(/(?:department|buyer|organisation|company)[:\s]+([^\n\r]{3,80})/i)
  const contactMatch = text.match(/(?:contact|enquiries?)[:\s]+([^\n\r]{6,100})/i)
  const closingMatch = text.match(/(?:closing|submission)\s+date[:\s]+([^\n\r.]{6,40})/i)
  const provinceMatch = text.match(
    /\b(Gauteng|Western Cape|KwaZulu-Natal|Eastern Cape|Limpopo|Mpumalanga|North West|Free State|Northern Cape|National)\b/i
  )
  const sectorMatch = text.match(/\b(construction|IT|services|supply|maintenance|consulting)\b/i)

  return {
    tenderNumber: tenderMatch ? tenderMatch[1].trim() : null,
    title: subject || text.slice(0, 120).trim(),
    buyer: deptMatch ? deptMatch[1].trim() : null,
    department: deptMatch ? deptMatch[1].trim() : null,
    scope: text.slice(0, 800),
    briefingDate: briefing.extractedDate,
    briefingVenue: briefing.extractedVenue,
    compulsoryBriefing: briefing.compulsoryBriefing,
    closingDate: closingMatch ? closingMatch[1].trim() : null,
    contactPerson: contactMatch ? contactMatch[1].trim() : null,
    province: provinceMatch ? provinceMatch[1] : null,
    category: sectorMatch ? sectorMatch[1].toLowerCase() : 'general',
    briefingDetected: briefing.detectedBriefing,
    extractionMethod: 'rules',
  }
}

async function aiExtraction(text, subject = '') {
  try {
    const openai = require('../integrations/openaiService')
    const prompt = `Extract procurement RFQ fields from this forwarded email. Return JSON only with keys: tenderNumber, title, buyer, department, scope, briefingDate, briefingVenue, compulsoryBriefing (boolean), closingDate, contactPerson, province, category, confidence (0-1).

Subject: ${subject}
Body:
${text.slice(0, 6000)}`

    const result = await openai.chatCompletion(
      [
        { role: 'system', content: 'You extract South African tender/RFQ metadata. JSON only.' },
        { role: 'user', content: prompt },
      ],
      { json: true, max_tokens: 800 }
    )

    if (!result.ok || !result.content) return null

    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    return {
      ...parsed,
      compulsoryBriefing: Boolean(parsed.compulsoryBriefing),
      briefingDetected: Boolean(parsed.compulsoryBriefing || parsed.briefingDate),
      extractionMethod: 'openai',
      confidence: Number(parsed.confidence) || 0.75,
    }
  } catch {
    return null
  }
}

function buildReadinessScore(extraction, attachments = []) {
  const missing = []
  for (const field of REQUIRED_DISPATCH_FIELDS) {
    if (!extraction[field]) missing.push(field)
  }
  if (!extraction.briefingDetected && !extraction.compulsoryBriefing) {
    missing.push('briefing_signal')
  }

  const confidence = extraction.confidence ?? (extraction.extractionMethod === 'openai' ? 0.75 : 0.55)
  const dispatchEligible =
    missing.length === 0 && confidence >= 0.5 && Boolean(extraction.title)

  let urgency = 'normal'
  if (extraction.compulsoryBriefing) urgency = 'high'
  if (extraction.closingDate) {
    const days = Math.ceil(
      (new Date(extraction.closingDate).getTime() - Date.now()) / 86400000
    )
    if (days >= 0 && days <= 3) urgency = 'critical'
    else if (days <= 7) urgency = 'high'
  }

  const checklist = []
  if (!extraction.briefingDate) checklist.push('Confirm briefing date')
  if (!extraction.briefingVenue) checklist.push('Confirm briefing venue')
  if (!extraction.province) checklist.push('Confirm province')
  if (attachments.length === 0) checklist.push('Attach tender PDF if available')
  if (!extraction.tenderNumber) checklist.push('Add tender/RFQ reference number')
  if (dispatchEligible) checklist.push('Ready to convert and request youth agent')

  return {
    briefingDetected: Boolean(extraction.briefingDetected || extraction.compulsoryBriefing),
    dispatchEligible,
    dispatchReadiness: dispatchEligible ? 'ready' : missing.length <= 2 ? 'review' : 'incomplete',
    urgency,
    missingFields: missing,
    confidence,
    smeActionChecklist: checklist,
  }
}

async function extractFromPayload(payload = {}) {
  const text = normalizeEmailBody(payload)
  const subject = payload.subject || ''
  const rule = ruleBasedExtraction(text, subject)
  const ai = await aiExtraction(text, subject)
  const merged = {
    ...rule,
    ...(ai || {}),
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
  }
  if (!merged.confidence) {
    merged.confidence = ai ? ai.confidence : rule.briefingDetected ? 0.6 : 0.45
  }
  merged.readiness = buildReadinessScore(merged, merged.attachments)
  return merged
}

async function processAttachments(extraction, attachments = []) {
  const results = []
  for (const att of attachments) {
    const meta = { name: att.name, url: att.url, type: att.type || 'file', scannedAt: new Date().toISOString() }
    if (att.buffer && Buffer.isBuffer(att.buffer)) {
      try {
        const pdf = await pdfExtraction.extractFromPdfBuffer(att.buffer, {
          source: 'rfq_inbox_attachment',
          docId: `rfq-pdf-${Date.now()}`,
        })
        meta.extraction = pdf
        if (pdf.briefingDate && !extraction.briefingDate) extraction.briefingDate = pdf.briefingDate
        if (pdf.briefingVenue && !extraction.briefingVenue) extraction.briefingVenue = pdf.briefingVenue
        if (pdf.compulsoryBriefing) extraction.compulsoryBriefing = true
      } catch {
        meta.error = 'pdf_scan_failed'
      }
    } else if (att.url && String(att.url).toLowerCase().includes('.pdf')) {
      try {
        const pdf = await pdfExtraction.extractFromUrl(att.url, { source: 'rfq_inbox_attachment' })
        if (pdf.ok && pdf.data) {
          meta.extraction = pdf.data
          if (pdf.data.briefingDate && !extraction.briefingDate) extraction.briefingDate = pdf.data.briefingDate
          if (pdf.data.briefingVenue && !extraction.briefingVenue) extraction.briefingVenue = pdf.data.briefingVenue
        }
      } catch {
        meta.error = 'pdf_fetch_failed'
      }
    }
    results.push(meta)
  }
  extraction.attachmentResults = results
  extraction.readiness = buildReadinessScore(extraction, results)
  return extraction
}

async function ingestEmail(payload) {
  const db = getFirestore()
  const text = normalizeEmailBody(payload)
  const extraction = await extractFromPayload(payload)
  await processAttachments(extraction, payload.attachments || [])

  let duplicateRisk = null
  try {
    const storage = getStorage()
    const existing = await storage.getAllTenders()
    const candidate = {
      tenderNumber: extraction.tenderNumber || `rfq-${Date.now()}`,
      title: extraction.title,
      department: extraction.department,
      briefingDate: extraction.briefingDate,
      source: 'private_email',
    }
    duplicateRisk = procurementDedup.findDuplicateInList(existing, candidate)
  } catch {
    duplicateRisk = null
  }

  const ref = db.collection(COLLECTION).doc()
  const doc = sanitizeFirestoreData({
    id: ref.id,
    fromEmail: payload.fromEmail || payload.from || null,
    subject: payload.subject || '',
    rawEmailText: text.slice(0, 12000),
    source: payload.source || 'manual_upload',
    forwardedByUid: payload.forwardedByUid || null,
    forwardedByEmail: payload.forwardedByEmail || null,
    attachments: extraction.attachmentResults || payload.attachments || [],
    extraction,
    duplicateRisk: duplicateRisk
      ? { duplicate: true, reason: duplicateRisk.reason }
      : { duplicate: false },
    status: 'pending_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  await ref.set(doc)

  try {
    const rfqTriage = require('../ai/rfqTriageService')
    await rfqTriage.triageIngestedEmail(doc)
  } catch {
    /* triage optional */
  }

  return doc
}

async function getById(id) {
  const db = getFirestore()
  const snap = await db.collection(COLLECTION).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() }
}

async function updateStatus(id, status, extra = {}) {
  const db = getFirestore()
  await db.collection(COLLECTION).doc(id).set(
    sanitizeFirestoreData({
      status,
      updatedAt: new Date().toISOString(),
      ...extra,
    }),
    { merge: true }
  )
  return getById(id)
}

async function rerunExtraction(id) {
  const doc = await getById(id)
  if (!doc) throw new Error('RFQ email not found')
  const extraction = await extractFromPayload({
    subject: doc.subject,
    rawEmailText: doc.rawEmailText,
    attachments: doc.attachments,
  })
  await processAttachments(extraction, doc.attachments || [])
  const db = getFirestore()
  await db.collection(COLLECTION).doc(id).set(
    sanitizeFirestoreData({ extraction, updatedAt: new Date().toISOString() }),
    { merge: true }
  )
  const updated = await getById(id)
  try {
    const rfqTriage = require('../ai/rfqTriageService')
    await rfqTriage.triageIngestedEmail(updated)
  } catch {
    /* optional */
  }
  return updated
}

async function listIngested({ limit = 50, forwardedByUid = null, status = null } = {}) {
  const db = getFirestore()
  let query = db.collection(COLLECTION)
  if (forwardedByUid) {
    query = query.where('forwardedByUid', '==', forwardedByUid)
  }
  const snap = await query.limit(limit).get().catch(() => ({ docs: [] }))
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (status) items = items.filter((i) => i.status === status)
  return items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

async function convertToPrivateOpportunity(emailId, options = {}) {
  const doc = await getById(emailId)
  if (!doc) throw new Error('RFQ email not found')
  if (doc.status === 'rejected') throw new Error('Rejected RFQs cannot be converted')
  if (!doc.forwardedByUid && !options.ownerUid) {
    throw new Error('ownerUid required for private opportunity')
  }

  const ownerUid = options.ownerUid || doc.forwardedByUid
  const ex = doc.extraction || {}
  const tenderNumber =
    ex.tenderNumber || `PRIVATE-${emailId.slice(0, 8).toUpperCase()}`

  const tender = createEmptyTenderBriefing({
    id: `tb-${tenderNumber.replace(/[^a-zA-Z0-9]/g, '-')}`,
    tenderNumber,
    title: ex.title || doc.subject || 'Private RFQ opportunity',
    description: ex.scope || doc.rawEmailText?.slice(0, 4000) || '',
    department: ex.department || ex.buyer || 'Private RFQ',
    buyer: ex.buyer || ex.department || '',
    province: ex.province || 'Unknown',
    category: ex.category || 'general',
    industrySector: ex.category || 'general',
    closingDate: ex.closingDate || '',
    briefingDate: ex.briefingDate || '',
    briefingVenue: ex.briefingVenue || '',
    briefingCompulsory: Boolean(ex.compulsoryBriefing),
    briefingConfidence: ex.readiness?.confidence ?? ex.confidence ?? 0.5,
    contactPerson: ex.contactPerson || '',
    source: 'private_email',
    visibility: 'private',
    ownerUid,
    originalEmailId: emailId,
    dispatchEligible: ex.readiness?.dispatchEligible !== false,
    privateRfq: true,
    lastSyncedAt: new Date().toISOString(),
    scrapedAt: new Date().toISOString(),
  })

  const storage = getStorage()
  await storage.upsertTenders([tender])

  await updateStatus(emailId, 'converted', {
    convertedTenderId: tender.id,
    convertedAt: new Date().toISOString(),
    approvedBy: options.approvedBy || null,
  })

  return { tender, email: await getById(emailId) }
}

function canUserAccessEmail(doc, user) {
  if (!user) return false
  if (user.userType === 'admin') return true
  if (user.userType === 'sme' && doc.forwardedByUid === user.uid) return true
  return false
}

module.exports = {
  COLLECTION,
  ingestEmail,
  getById,
  listIngested,
  updateStatus,
  rerunExtraction,
  convertToPrivateOpportunity,
  extractFromPayload,
  buildReadinessScore,
  canUserAccessEmail,
}
