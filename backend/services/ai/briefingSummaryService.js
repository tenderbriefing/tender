/**
 * Executive briefing summaries — risks, action items, disqualifiers, multimodal hints.
 */
const { persistInsight, nowIso } = require('./_shared')
const COLLECTIONS = require('./autonomousCollections')

function extractActionItems(text) {
  const lines = String(text || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10)
  return lines
    .filter((l) => /must|shall|required|submit|deadline|bring|attend/i.test(l))
    .slice(0, 10)
}

function extractRisks(text) {
  const risks = []
  if (/disqualif|late|penalt|non-complian/i.test(text)) risks.push('Compliance or disqualification risk noted')
  if (/site visit|compulsory/i.test(text)) risks.push('Compulsory attendance requirements mentioned')
  if (/mandatory|original certified/i.test(text)) risks.push('Mandatory document requirements detected')
  if (!text || text.length < 50) risks.push('Report content is thin — verify with SME')
  return risks
}

function extractHiddenDisqualifiers(text) {
  const found = []
  if (/non-responsive|late submission|no substitute/i.test(text)) found.push('Late or non-responsive submission risk')
  if (/mandatory meeting|compulsory briefing/i.test(text)) found.push('Compulsory briefing attendance may be disqualifying')
  if (/CSD|tax clearance|BBBEE/i.test(text)) found.push('Registration/compliance prerequisites mentioned')
  return found.slice(0, 6)
}

async function executiveSummaryFromOpenAi(body, report) {
  try {
    const openai = require('../integrations/openaiService')
    const result = await openai.chatCompletion(
      [
        {
          role: 'system',
          content:
            'You produce executive tender briefing summaries for South African SMEs. Return JSON only.',
        },
        {
          role: 'user',
          content: `Summarize this briefing report. Keys: executiveSummary, risks[], clarifications[], actionItems[], missingRequirements[], hiddenDisqualifiers[], competitorInsights[], submissionRecommendations[].

Tender: ${report.tenderTitle || report.tenderId || 'N/A'}
Content:
${body.slice(0, 5000)}`,
        },
      ],
      { json: true, max_tokens: 1200 }
    )
    if (!result.ok || !result.content) return null
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

async function summarizeBriefingReport(report, options = {}) {
  const body = [
    report.summary,
    report.notes,
    report.keyFindings,
    report.attendanceOutcome,
    report.transcript,
  ]
    .filter(Boolean)
    .join('\n')

  const hasMultimodal =
    Boolean(report.voiceNoteUrl) ||
    Boolean(report.photoUrls?.length) ||
    Boolean(report.pdfUrl || report.documentUrl)

  let executive = null
  if (options.executive !== false) {
    executive = await executiveSummaryFromOpenAi(body, report)
  }

  const outcome =
    report.attendanceOutcome ||
    (report.status === 'submitted' ? 'Agent attended and submitted report' : 'Pending review')

  const insight = {
    reportId: report.id,
    requestId: report.requestId || null,
    agentId: report.agentId || null,
    executiveSummary:
      executive?.executiveSummary || body.slice(0, 500) || 'No narrative provided.',
    narrativeSummary: body.slice(0, 1200) || 'No narrative provided.',
    risks: executive?.risks?.length ? executive.risks : extractRisks(body),
    clarifications: executive?.clarifications || [],
    actionItems: executive?.actionItems?.length ? executive.actionItems : extractActionItems(body),
    missingRequirements: executive?.missingRequirements || [],
    hiddenDisqualifiers:
      executive?.hiddenDisqualifiers?.length
        ? executive.hiddenDisqualifiers
        : extractHiddenDisqualifiers(body),
    competitorInsights: executive?.competitorInsights || [],
    submissionRecommendations:
      executive?.submissionRecommendations ||
      (extractActionItems(body).length
        ? ['Review action items before submission']
        : ['Confirm all tender returnables']),
    attendanceOutcome: outcome,
    multimodal: hasMultimodal
      ? {
          voiceNote: Boolean(report.voiceNoteUrl),
          images: report.photoUrls?.length || 0,
          pdf: Boolean(report.pdfUrl || report.documentUrl),
        }
      : null,
    aiProvider: executive ? 'openai' : 'rule-based',
    capturedAt: nowIso(),
  }

  if (report.id) {
    await persistInsight('aiBriefingInsights', String(report.id), insight)
    await persistInsight(COLLECTIONS.EXECUTIVE_BRIEFING_SUMMARIES, String(report.id), insight)
  }
  return insight
}

module.exports = { summarizeBriefingReport, extractActionItems, extractRisks }
