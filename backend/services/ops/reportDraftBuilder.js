/**
 * Deterministic draft builder for Phase 11 client reports.
 * Never invents facts; flags source conflicts; third-person default.
 * Excludes representative payout and internal ops notes.
 */

const INTERNAL_NOTE_KEYS = new Set([
  'representativeInternalNotes',
  'internalNotes',
  'agentPayoutCents',
  'representativePayoutCents',
  'representativeAssignedBy',
  'representativeAssignedByEmail',
])

function clean(value) {
  const s = String(value || '').trim()
  return s || null
}

function thirdPersonAttendance(request) {
  const client =
    clean(request.representedEntity) ||
    clean(request.registerAttendOnBehalfOf) ||
    clean(request.smeCompany) ||
    clean(request.smeName) ||
    'the client'
  const date = clean(request.briefingDate) || 'the scheduled briefing date'
  const venue = clean(request.briefingVenue)
  const time = clean(request.briefingTime)
  let sentence = `A TenderBriefing representative attended the briefing on behalf of ${client} on ${date}`
  if (time) sentence += ` at ${time}`
  if (venue) sentence += `, held at ${venue}`
  sentence += '.'
  return sentence
}

function detectSourceConflicts(request) {
  const conflicts = []
  const lines = Array.isArray(request.briefingLines) ? request.briefingLines : []
  const parentTime = clean(request.briefingTime)
  const parentDate = clean(request.briefingDate)
  const parentVenue = clean(request.briefingVenue)

  for (const line of lines) {
    if (parentTime && clean(line.briefingTime) && clean(line.briefingTime) !== parentTime) {
      conflicts.push({
        field: 'briefingTime',
        message: `SOURCE CONFLICT — briefing time requires review (request: ${parentTime}; line ${line.lineNumber || ''}: ${line.briefingTime})`,
        sources: [parentTime, line.briefingTime],
      })
    }
    if (parentDate && clean(line.briefingDate) && clean(line.briefingDate) !== parentDate) {
      conflicts.push({
        field: 'briefingDate',
        message: `SOURCE CONFLICT — briefing date requires review (request: ${parentDate}; line ${line.lineNumber || ''}: ${line.briefingDate})`,
        sources: [parentDate, line.briefingDate],
      })
    }
    if (parentVenue && clean(line.briefingVenue) && clean(line.briefingVenue) !== parentVenue) {
      conflicts.push({
        field: 'briefingVenue',
        message: `SOURCE CONFLICT — briefing venue requires review (request vs line ${line.lineNumber || ''})`,
        sources: [parentVenue, line.briefingVenue],
      })
    }
  }
  return conflicts
}

function evidenceManifest(request) {
  const items = Array.isArray(request.evidenceItems) ? request.evidenceItems : []
  const byCategory = {}
  for (const item of items) {
    const cat = String(item.category || 'other')
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push({
      id: item.id,
      fileName: item.fileName,
      contentType: item.contentType,
      category: cat,
      storagePath: item.storagePath,
      caption: clean(item.caption) || null,
      included: item.includedInReport !== false,
    })
  }
  return { items: items.map((i) => ({ ...i, included: i.includedInReport !== false })), byCategory }
}

/**
 * Build a structured draft document. Sections only when supported by data.
 */
function buildReportDraft(request, opts = {}) {
  const conflicts = detectSourceConflicts(request)
  const evidence = evidenceManifest(request)
  const client =
    clean(request.representedEntity) ||
    clean(request.registerAttendOnBehalfOf) ||
    clean(request.smeCompany) ||
    'Client'
  const company = clean(request.smeCompany) || client

  const sections = []

  // Executive brief — always
  const execParas = [
    thirdPersonAttendance(request),
    `This report summarises information available from the TenderBriefing attendance record and supporting evidence for tender/RFQ ${clean(request.tenderNumber) || '—'}.`,
  ]
  if (clean(request.tenderTitle)) {
    execParas.push(`The briefing related to: ${request.tenderTitle}.`)
  }
  if (request.attended === true || request.attendedAt) {
    execParas.push('Attendance was confirmed by TenderBriefing operations.')
  } else {
    execParas.push(
      'Attendance confirmation was not marked on the operational record at the time this draft was generated — review before approval.'
    )
  }
  if (evidence.items.length === 0) {
    execParas.push(
      'Limited supporting evidence was on file when this draft was generated. Sections below reflect verified request metadata only.'
    )
  }
  sections.push({
    id: 'executive_brief',
    title: 'Executive Brief',
    locked: false,
    humanEdited: false,
    paragraphs: execParas,
    source: 'verified_metadata',
  })

  // Briefing details table-like content
  const detailLines = []
  const pushDetail = (label, value) => {
    if (clean(value)) detailLines.push({ label, value: clean(value) })
  }
  pushDetail('Tender / RFQ number', request.tenderNumber)
  pushDetail('Description', request.tenderTitle)
  pushDetail('Procuring entity', request.department || request.procuringEntity)
  pushDetail('Prepared for', client)
  pushDetail('Paying customer', company !== client ? company : null)
  pushDetail('Briefing date', request.briefingDate)
  pushDetail('Briefing time', request.briefingTime)
  pushDetail('Venue', request.briefingVenue)
  pushDetail('Province', request.province)
  if (Array.isArray(request.briefingLines) && request.briefingLines[0]) {
    const line = request.briefingLines[0]
    pushDetail('Closing date', line.closingDate)
    pushDetail('Closing time', line.closingTime)
    pushDetail('Briefing contact', line.contactPerson)
    pushDetail('Briefing contact phone', line.contactPhone)
    pushDetail('Briefing contact email', line.contactEmail)
  }
  sections.push({
    id: 'briefing_details',
    title: 'Briefing Details',
    locked: false,
    humanEdited: false,
    paragraphs: [],
    details: detailLines,
    source: 'verified_metadata',
  })

  // Scope / description from tender description only
  if (clean(request.tenderTitle) || (request.briefingLines && request.briefingLines[0]?.tenderDescription)) {
    const desc =
      clean(request.briefingLines?.[0]?.tenderDescription) || clean(request.tenderTitle)
    sections.push({
      id: 'scope_of_work',
      title: 'Scope of Work',
      locked: false,
      humanEdited: false,
      paragraphs: [
        `According to the tender/RFQ description on the attendance record: ${desc}.`,
        'Bidders should verify the full official scope in the published tender/RFQ documents and any addenda issued by the procuring institution.',
      ],
      source: 'verified_metadata',
    })
  }

  // Evidence-derived notes (admin attendance note — not internal payout notes)
  const attendanceNote = clean(request.attendanceNote)
  if (attendanceNote && !INTERNAL_NOTE_KEYS.has('attendanceNote')) {
    sections.push({
      id: 'briefing_observations',
      title: 'Briefing Observations',
      locked: false,
      humanEdited: false,
      paragraphs: [
        'The following observation was recorded by TenderBriefing operations after the briefing:',
        attendanceNote,
      ],
      source: 'evidence_derived',
    })
  }

  // Site / technical observations — photo list (no invented captions)
  const photoCats = ['site_photos', 'briefing_photos']
  const photos = evidence.items.filter(
    (i) => photoCats.includes(i.category) && i.included !== false
  )
  if (photos.length) {
    sections.push({
      id: 'site_observations',
      title: 'Site / Technical Observations',
      locked: false,
      humanEdited: false,
      paragraphs: [
        `${photos.length} photographic evidence item(s) were attached to this briefing record. Images appear in the appendix where file format permits embedding.`,
      ],
      imageRefs: photos.map((p, idx) => ({
        evidenceId: p.id,
        fileName: p.fileName,
        category: p.category,
        caption: p.caption || `Figure ${idx + 1}: ${p.category.replace(/_/g, ' ')} — ${p.fileName}`,
      })),
      source: 'evidence_derived',
    })
  }

  // Attendance proof — once
  const attendance = evidence.items.filter(
    (i) => i.category === 'attendance_proof' && i.included !== false
  )
  if (attendance.length) {
    const primary = attendance[0]
    sections.push({
      id: 'proof_of_attendance',
      title: 'Proof of Attendance',
      locked: false,
      humanEdited: false,
      paragraphs: [
        'The attendance register / proof of attendance is included once below for verification.',
      ],
      imageRefs: [
        {
          evidenceId: primary.id,
          fileName: primary.fileName,
          category: primary.category,
          caption: 'Proof of Attendance',
        },
      ],
      // Explicitly do not duplicate remaining attendance proofs
      source: 'evidence_derived',
    })
  }

  // Key actions — conservative, metadata-based
  const actions = [
    'Review the official tender/RFQ pack and any addenda or clarifications issued by the procuring institution.',
    'Confirm compulsory briefing attendance requirements against the official notice.',
  ]
  if (request.briefingLines?.[0]?.closingDate) {
    actions.push(
      `Note the recorded closing date on file (${request.briefingLines[0].closingDate}${
        request.briefingLines[0].closingTime ? ` ${request.briefingLines[0].closingTime}` : ''
      }) and verify it against the official closing date.`
    )
  }
  if (conflicts.length) {
    actions.push('Resolve all SOURCE CONFLICT flags listed in this draft before relying on the report.')
  }
  sections.push({
    id: 'key_actions',
    title: 'Key Actions for Bidder',
    locked: false,
    humanEdited: false,
    paragraphs: [],
    bullets: actions,
    source: 'tenderbriefing_recommendation',
  })

  // Disclaimer
  sections.push({
    id: 'disclaimer',
    title: 'Disclaimer',
    locked: false,
    humanEdited: false,
    paragraphs: [
      'This report summarises information captured during the TenderBriefing attendance process and should be read together with the official tender/RFQ documents and any formal addenda or clarifications issued by the procuring institution. TenderBriefing does not replace the bidder’s obligation to verify requirements directly from official sources.',
    ],
    source: 'verified_metadata',
  })

  // Sanitize: never leak payout fields into draft JSON
  const safeRequestSnapshot = {
    tenderNumber: request.tenderNumber || null,
    tenderTitle: request.tenderTitle || null,
    smeCompany: request.smeCompany || null,
    representedEntity: request.representedEntity || request.registerAttendOnBehalfOf || null,
    briefingDate: request.briefingDate || null,
    briefingTime: request.briefingTime || null,
    briefingVenue: request.briefingVenue || null,
    province: request.province || null,
    department: request.department || null,
    attended: request.attended === true,
    evidenceCount: evidence.items.length,
  }

  return {
    schemaVersion: 1,
    language: 'en-ZA',
    voice: 'third_person',
    cover: {
      title: 'TENDER BRIEFING REPORT',
      tenderNumber: clean(request.tenderNumber) || '—',
      tenderDescription: clean(request.tenderTitle) || '—',
      issuingInstitution: clean(request.department) || clean(request.procuringEntity) || '—',
      preparedFor: client,
      briefingDate: clean(request.briefingDate) || '—',
      preparedBy: 'TenderBriefing',
    },
    sections,
    sourceConflicts: conflicts,
    evidenceIndex: evidence.items.map((i) => ({
      id: i.id,
      category: i.category,
      fileName: i.fileName,
      included: i.included !== false,
    })),
    requestSnapshot: safeRequestSnapshot,
    generatedAt: new Date().toISOString(),
    generator: opts.generator || 'ops-report-draft-v1',
  }
}

/** Apply human section edits without wiping other sections. */
function applySectionEdits(draft, edits = {}) {
  const next = JSON.parse(JSON.stringify(draft || {}))
  const sectionEdits = Array.isArray(edits.sections) ? edits.sections : []
  for (const edit of sectionEdits) {
    if (!edit || !edit.id) continue
    const idx = (next.sections || []).findIndex((s) => s.id === edit.id)
    if (idx < 0) continue
    const current = next.sections[idx]
    const nextSection = {
      ...current,
      title: edit.title != null ? String(edit.title) : current.title,
      humanEdited: true,
      locked: edit.locked === true ? true : current.locked,
    }
    if (Array.isArray(edit.paragraphs)) nextSection.paragraphs = edit.paragraphs.map(String)
    else if (current.paragraphs != null) nextSection.paragraphs = current.paragraphs
    if (Array.isArray(edit.bullets)) nextSection.bullets = edit.bullets.map(String)
    else if (current.bullets != null) nextSection.bullets = current.bullets
    if (Array.isArray(edit.details)) nextSection.details = edit.details
    else if (current.details != null) nextSection.details = current.details
    if (Array.isArray(edit.imageRefs)) nextSection.imageRefs = edit.imageRefs
    else if (current.imageRefs != null) nextSection.imageRefs = current.imageRefs
    // Drop undefined keys so Firestore writes do not reject the document
    for (const key of Object.keys(nextSection)) {
      if (nextSection[key] === undefined) delete nextSection[key]
    }
    next.sections[idx] = nextSection
  }
  if (edits.cover && typeof edits.cover === 'object') {
    next.cover = { ...next.cover, ...edits.cover, humanEdited: true }
  }
  if (Array.isArray(edits.excludedEvidenceIds)) {
    const exclude = new Set(edits.excludedEvidenceIds.map(String))
    next.evidenceIndex = (next.evidenceIndex || []).map((e) => ({
      ...e,
      included: exclude.has(e.id) ? false : e.included !== false,
    }))
    for (const section of next.sections || []) {
      if (!Array.isArray(section.imageRefs)) continue
      section.imageRefs = section.imageRefs.filter((r) => !exclude.has(String(r.evidenceId)))
    }
  }
  next.updatedAt = new Date().toISOString()
  return next
}

/**
 * Regenerate one section from source data without overwriting human-edited sections
 * unless force=true.
 */
function regenerateSection(draft, request, sectionId, { force = false } = {}) {
  const fresh = buildReportDraft(request)
  const next = JSON.parse(JSON.stringify(draft || {}))
  const freshSection = (fresh.sections || []).find((s) => s.id === sectionId)
  if (!freshSection) throw new Error(`Unknown section: ${sectionId}`)
  const idx = (next.sections || []).findIndex((s) => s.id === sectionId)
  if (idx >= 0) {
    const current = next.sections[idx]
    if (current.humanEdited && !force) {
      throw new Error(
        `Section "${sectionId}" has human edits — pass force=true to overwrite`
      )
    }
    next.sections[idx] = { ...freshSection, humanEdited: false }
  } else {
    next.sections.push({ ...freshSection, humanEdited: false })
  }
  next.sourceConflicts = fresh.sourceConflicts
  next.updatedAt = new Date().toISOString()
  return next
}

function assertNoInternalLeakage(draft) {
  const blob = JSON.stringify(draft || {})
  if (/agentPayoutCents|representativePayoutCents|representativeInternalNotes/i.test(blob)) {
    throw new Error('Draft contains internal payout/notes — blocked')
  }
  return true
}

module.exports = {
  buildReportDraft,
  applySectionEdits,
  regenerateSection,
  detectSourceConflicts,
  thirdPersonAttendance,
  assertNoInternalLeakage,
  evidenceManifest,
}
