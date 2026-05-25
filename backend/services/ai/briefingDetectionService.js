/**
 * AI briefing detection — compulsory briefings, site visits, clarification meetings.
 */
const { persistInsight, nowIso } = require('./_shared')

const BRIEFING_PATTERNS = [
  { type: 'compulsory_briefing', regex: /compulsory\s+(briefing|site\s+inspection|site\s+briefing|meeting)/i, weight: 0.95 },
  { type: 'mandatory_briefing', regex: /mandatory\s+(briefing|site|meeting)/i, weight: 0.9 },
  { type: 'clarification_meeting', regex: /clarification\s+(meeting|session)/i, weight: 0.85 },
  { type: 'site_inspection', regex: /compulsory\s+site\s+inspection|site\s+inspection/i, weight: 0.88 },
  { type: 'briefing_session', regex: /briefing\s+session/i, weight: 0.82 },
  { type: 'bidders_meeting', regex: /bidders?\s+meeting/i, weight: 0.8 },
  { type: 'technical_briefing', regex: /technical\s+briefing/i, weight: 0.84 },
  { type: 'site_visit', regex: /site\s+visit|pre\s+tender\s+site/i, weight: 0.75 },
]

function extractDate(text) {
  const m = String(text).match(
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/
  )
  return m ? m[1] : null
}

function extractVenue(text) {
  const m = String(text).match(
    /(?:venue|location|address|at)[:\s]+([^\n\r.]{8,140})/i
  )
  return m ? m[1].trim() : null
}

function detectBriefing(text = '', options = {}) {
  const body = String(text)
  const matches = []

  for (const p of BRIEFING_PATTERNS) {
    const m = body.match(p.regex)
    if (m) {
      matches.push({
        type: p.type,
        phrase: m[0],
        weight: p.weight,
      })
    }
  }

  const detectedBriefing = matches.length > 0
  const top = matches.sort((a, b) => b.weight - a.weight)[0]
  const confidence = top ? Math.round(top.weight * 100) / 100 : 0
  const compulsory = /compulsory|mandatory/i.test(body) && detectedBriefing

  const reasoning = detectedBriefing
    ? `Matched ${matches.length} briefing signal(s): ${matches.map((x) => x.type).join(', ')}`
    : 'No briefing keywords detected'

  return {
    detectedBriefing,
    confidence,
    reasoning,
    extractedVenue: extractVenue(body) || options.venue || null,
    extractedDate: extractDate(body) || options.date || null,
    compulsoryBriefing: compulsory,
    matches,
    analyzedAt: nowIso(),
  }
}

async function detectAndPersist(tenderId, text, options = {}) {
  const result = detectBriefing(text, options)
  if (tenderId) {
    await persistInsight('aiBriefingInsights', String(tenderId), {
      tenderId,
      ...result,
      source: options.source || 'briefing_detection',
    })
  }
  return result
}

module.exports = {
  BRIEFING_PATTERNS,
  detectBriefing,
  detectAndPersist,
}
