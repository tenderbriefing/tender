const { env, hasEnv, checkRequired, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = ['OPENAI_API_KEY']
const OPENAI_BASE = 'https://api.openai.com/v1'

const PROMPTS = {
  tenderSummary: (tender) =>
    `Summarize this South African government tender for an SME bidder.\n` +
    `Title: ${tender.title}\n` +
    `Department: ${tender.department || 'N/A'}\n` +
    `Province: ${tender.province || 'N/A'}\n` +
    `Briefing: ${tender.briefingCompulsory ? 'Compulsory' : 'Optional'} on ${tender.briefingDate || 'TBC'}\n` +
    `Closing: ${tender.closingDate || 'TBC'}\n` +
    `Description: ${tender.description || ''}\n` +
    `Return JSON: { "summary": string, "requirements": string[], "risks": string[] }`,

  briefingSummary: (report) =>
    `Summarize this tender briefing attendance report for the SME.\n` +
    `Tender: ${report.tenderTitle || report.tenderId}\n` +
    `Notes: ${report.notes || report.summary || ''}\n` +
    `Return JSON: { "summary": string, "actionItems": string[] }`,
}

function getConfig() {
  return checkRequired(REQUIRED_ENV)
}

function getStatus() {
  const config = getConfig()
  return integrationResult({
    id: 'openai',
    name: 'OpenAI API',
    status: statusFromConfig(config.configured),
    requiredEnv: [...REQUIRED_ENV, 'OPENAI_MODEL'],
    missing: config.missing,
    setupNotes:
      'Optional in production — rule-based summaries used when key is missing. Store key in Secret Manager as openai-api-key.',
  })
}

function ruleBasedTenderSummary(tender) {
  return {
    summary: `${tender.title || 'Tender'} — ${tender.department || 'Government'} (${tender.province || 'ZA'}).`,
    requirements: [
      tender.briefingCompulsory ? 'Attend compulsory briefing' : 'Review briefing details',
      tender.closingDate ? `Submit before ${tender.closingDate}` : 'Confirm closing date',
    ],
    risks: tender.briefingCompulsory && !tender.briefingVenue ? ['Briefing venue TBC'] : [],
    provider: 'rule-based',
  }
}

function ruleBasedBriefingSummary(report) {
  return {
    summary: report.notes || report.summary || 'Briefing report recorded.',
    actionItems: ['Review uploaded proof', 'Confirm compliance with tender requirements'],
    provider: 'rule-based',
  }
}

async function chatCompletion(messages, options = {}) {
  const apiKey = env('OPENAI_API_KEY')
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'OPENAI_API_KEY not configured' }
  }

  const model = env('OPENAI_MODEL') || 'gpt-4o-mini'
  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      response_format: options.json ? { type: 'json_object' } : undefined,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, error: data.error?.message || `OpenAI HTTP ${response.status}` }
  }

  const content = data.choices?.[0]?.message?.content
  return { ok: true, content, raw: data }
}

async function summarizeTender(tender) {
  if (!hasEnv('OPENAI_API_KEY')) {
    return { ok: true, ...ruleBasedTenderSummary(tender) }
  }

  const result = await chatCompletion(
    [
      { role: 'system', content: 'You are a South African procurement analyst. Respond in JSON only.' },
      { role: 'user', content: PROMPTS.tenderSummary(tender) },
    ],
    { json: true }
  )

  if (!result.ok) {
    return { ok: true, ...ruleBasedTenderSummary(tender), fallbackReason: result.error || result.reason }
  }

  try {
    const parsed = JSON.parse(result.content)
    return { ok: true, ...parsed, provider: 'openai' }
  } catch {
    return { ok: true, summary: result.content, provider: 'openai' }
  }
}

async function summarizeBriefingReport(report) {
  if (!hasEnv('OPENAI_API_KEY')) {
    return { ok: true, ...ruleBasedBriefingSummary(report) }
  }

  const result = await chatCompletion(
    [
      { role: 'system', content: 'You are a South African procurement analyst. Respond in JSON only.' },
      { role: 'user', content: PROMPTS.briefingSummary(report) },
    ],
    { json: true }
  )

  if (!result.ok) {
    return { ok: true, ...ruleBasedBriefingSummary(report), fallbackReason: result.error || result.reason }
  }

  try {
    const parsed = JSON.parse(result.content)
    return { ok: true, ...parsed, provider: 'openai' }
  } catch {
    return { ok: true, summary: result.content, provider: 'openai' }
  }
}

async function healthCheck() {
  return getStatus()
}

module.exports = {
  REQUIRED_ENV,
  PROMPTS,
  getConfig,
  getStatus,
  summarizeTender,
  summarizeBriefingReport,
  chatCompletion,
  healthCheck,
}
