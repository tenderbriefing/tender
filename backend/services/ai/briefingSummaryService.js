/**
 * Summarize uploaded briefing reports — action items, risks, outcomes.
 */
const { persistInsight, nowIso } = require('./_shared')

function extractActionItems(text) {
  const lines = String(text || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10)
  return lines
    .filter((l) => /must|shall|required|submit|deadline|bring|attend/i.test(l))
    .slice(0, 8)
}

function extractRisks(text) {
  const risks = []
  if (/disqualif|late|penalt|non-complian/i.test(text)) risks.push('Compliance or disqualification risk noted')
  if (/site visit|compulsory/i.test(text)) risks.push('Compulsory attendance requirements mentioned')
  if (!text || text.length < 50) risks.push('Report content is thin — verify with SME')
  return risks
}

async function summarizeBriefingReport(report) {
  const body = [
    report.summary,
    report.notes,
    report.keyFindings,
    report.attendanceOutcome,
  ]
    .filter(Boolean)
    .join('\n')

  const outcome =
    report.attendanceOutcome ||
    (report.status === 'submitted' ? 'Agent attended and submitted report' : 'Pending review')

  const insight = {
    reportId: report.id,
    requestId: report.requestId || null,
    agentId: report.agentId || null,
    narrativeSummary: body.slice(0, 1200) || 'No narrative provided.',
    actionItems: extractActionItems(body),
    risks: extractRisks(body),
    attendanceOutcome: outcome,
    aiProvider: 'rule-based',
    capturedAt: nowIso(),
  }

  if (report.id) {
    await persistInsight('aiBriefingInsights', String(report.id), insight)
  }
  return insight
}

module.exports = { summarizeBriefingReport }
