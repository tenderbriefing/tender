const BRIEFING_PATTERNS = [
  { key: 'compulsory briefing', term: 'compulsory briefing' },
  { key: 'compulsory site briefing', term: 'compulsory site briefing' },
  { key: 'site inspection', term: 'site inspection' },
  { key: 'clarification meeting', term: 'clarification meeting' },
  { key: 'briefing venue', term: 'briefing venue' },
  { key: 'briefing session', term: 'briefing session' },
  { key: 'attendance register', term: 'attendance register' },
  { key: 'cidb', term: 'cidb' },
]

const MEETING_LINK_PATTERNS = [
  /https?:\/\/[^\s]*teams\.microsoft\.com[^\s]*/gi,
  /https?:\/\/[^\s]*zoom\.us[^\s]*/gi,
  /https?:\/\/[^\s]*meet\.google\.com[^\s]*/gi,
]

const GPS_PATTERN =
  /(-?\d{1,3}\.\d{4,})[,\s]+(-?\d{1,3}\.\d{4,})/g

const TIME_PATTERN =
  /(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}h\d{2})/gi

const DATE_PATTERN =
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/g

function stripHtml(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchTextFromUrl(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TenderBriefing/1.0 (+https://tenderbriefing.co.za)',
      },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) return ''

    const contentType = response.headers.get('content-type') || ''
    const buffer = Buffer.from(await response.arrayBuffer())

    if (contentType.includes('pdf') || url.toLowerCase().includes('.pdf')) {
      return extractPdfText(buffer)
    }

    if (contentType.includes('html') || contentType.includes('text')) {
      const text = await response.text()
      return stripHtml(text)
    }

    return buffer.toString('utf8').slice(0, 50000)
  } catch {
    return ''
  }
}

function extractPdfText(buffer) {
  try {
    const raw = buffer.toString('latin1')
    const textChunks = []
    const regex = /\(([^()\\]{4,200})\)/g
    let match
    while ((match = regex.exec(raw)) !== null) {
      const chunk = match[1].replace(/\\n/g, ' ').trim()
      if (/[a-zA-Z]{3,}/.test(chunk)) textChunks.push(chunk)
    }
    return textChunks.join(' ').slice(0, 80000)
  } catch {
    return ''
  }
}

function analyzeText(text) {
  const lower = text.toLowerCase()
  const matchedBriefingTerms = []

  for (const pattern of BRIEFING_PATTERNS) {
    if (lower.includes(pattern.key)) matchedBriefingTerms.push(pattern.term)
  }

  let meetingLink = ''
  for (const linkPattern of MEETING_LINK_PATTERNS) {
    const match = text.match(linkPattern)
    if (match?.[0]) {
      meetingLink = match[0]
      break
    }
  }

  const gpsMatches = [...text.matchAll(GPS_PATTERN)]
  const gpsCoordinates = gpsMatches.map((m) => `${m[1]},${m[2]}`)

  const compulsory =
    lower.includes('compulsory briefing') ||
    lower.includes('briefing is compulsory') ||
    lower.includes('attendance is compulsory') ||
    lower.includes('compulsory site briefing')

  let briefingVenue = ''
  const venueMatch = text.match(
    /briefing\s+(?:venue|session|will be held at)[:\s]+([^\n.]{10,120})/i
  )
  if (venueMatch) briefingVenue = venueMatch[1].trim()

  let briefingTime = ''
  const timeMatch = text.match(TIME_PATTERN)
  if (timeMatch) briefingTime = timeMatch[0]

  let briefingDate = ''
  const dateMatch = text.match(DATE_PATTERN)
  if (dateMatch) briefingDate = dateMatch[0]

  const cidbGrading =
    text.match(/cidb[\s\w]*grading[:\s]*([^\n.]{3,40})/i)?.[1]?.trim() || ''

  const confidence = Math.min(
    0.98,
    0.3 +
      matchedBriefingTerms.length * 0.12 +
      (compulsory ? 0.25 : 0) +
      (briefingVenue ? 0.1 : 0) +
      (meetingLink ? 0.08 : 0)
  )

  return {
    matchedBriefingTerms,
    briefingCompulsory: compulsory,
    briefingConfidence: Math.round(confidence * 100) / 100,
    briefingVenue,
    briefingTime,
    briefingDate,
    meetingLink,
    gpsCoordinates,
    cidbGrading,
    requirements: [
      ...(cidbGrading ? [`CIDB grading: ${cidbGrading}`] : []),
      ...(lower.includes('attendance register')
        ? ['Attendance register required']
        : []),
    ],
  }
}

async function enrichFromDocuments(tender) {
  const documents = tender.documents || []
  let combinedText = [tender.description, tender.title].filter(Boolean).join('\n')

  const enrichedDocs = []
  for (const doc of documents.slice(0, 5)) {
    const url = typeof doc === 'string' ? doc : doc.url
    if (!url) continue

    const extractedText = await fetchTextFromUrl(url)
    if (extractedText) combinedText += `\n${extractedText}`

    enrichedDocs.push({
      ...(typeof doc === 'object' ? doc : { url }),
      extractedAt: new Date().toISOString(),
      textLength: extractedText.length,
    })
  }

  const analysis = analyzeText(combinedText)

  return {
    ...tender,
    documents: enrichedDocs.length ? enrichedDocs : documents,
    matchedBriefingTerms: [
      ...new Set([
        ...(tender.matchedBriefingTerms || []),
        ...analysis.matchedBriefingTerms,
      ]),
    ],
    briefingCompulsory:
      tender.briefingCompulsory || analysis.briefingCompulsory,
    briefingConfidence: Math.max(
      tender.briefingConfidence || 0,
      analysis.briefingConfidence
    ),
    briefingVenue: tender.briefingVenue || analysis.briefingVenue,
    briefingTime: tender.briefingTime || analysis.briefingTime,
    briefingDate: tender.briefingDate || analysis.briefingDate,
    meetingLink: tender.meetingLink || analysis.meetingLink,
    gpsCoordinates: analysis.gpsCoordinates,
    requirements: [
      ...new Set([...(tender.requirements || []), ...analysis.requirements]),
    ],
  }
}

module.exports = {
  stripHtml,
  fetchTextFromUrl,
  analyzeText,
  enrichFromDocuments,
}
