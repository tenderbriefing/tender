const SOURCE_LABEL = 'eTenders OCDS API + selective enrichment'

function createEmptyTenderBriefing(overrides = {}) {
  return {
    id: '',
    ocid: '',
    tenderNumber: '',
    title: '',
    description: '',
    department: '',
    buyer: '',
    province: '',
    category: '',
    industrySector: '',
    industryConfidence: 0,
    procurementMethod: '',
    status: 'active',
    publishedDate: '',
    closingDate: '',
    briefingDate: '',
    briefingTime: '',
    briefingVenue: '',
    briefingCompulsory: false,
    briefingConfidence: 0,
    matchedBriefingTerms: [],
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    meetingLink: '',
    documents: [],
    detailUrl: '',
    summary: '',
    requirements: [],
    risks: [],
    keyDates: [],
    recommendedFor: [],
    opportunityScore: 0,
    calendarEvents: [],
    history: [],
    source: SOURCE_LABEL,
    lastSyncedAt: '',
    scrapedAt: '',
    ...overrides,
  }
}

function contentHash(tender) {
  const payload = [
    tender.title,
    tender.description,
    tender.closingDate,
    tender.briefingDate,
    tender.briefingVenue,
    tender.status,
    JSON.stringify(tender.documents || []),
  ].join('|')
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i)
    hash |= 0
  }
  return String(hash)
}

module.exports = {
  SOURCE_LABEL,
  createEmptyTenderBriefing,
  contentHash,
}
