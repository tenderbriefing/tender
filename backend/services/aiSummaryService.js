function ruleBasedSummary(tender) {
  const requirements = [
    ...(tender.requirements || []),
    tender.briefingCompulsory
      ? 'Attendance at compulsory briefing is required'
      : null,
    tender.industrySector
      ? `Primary sector: ${tender.industrySector}`
      : null,
    tender.province ? `Province: ${tender.province}` : null,
  ].filter(Boolean)

  const risks = []
  if (tender.briefingCompulsory && !tender.briefingVenue) {
    risks.push('Compulsory briefing flagged but venue details are incomplete')
  }
  if (!tender.closingDate) {
    risks.push('Closing date not confirmed')
  }
  if ((tender.documents || []).length === 0) {
    risks.push('No tender documents attached in source data')
  }
  if (tender.status === 'cancelled') {
    risks.push('Tender status is cancelled')
  }

  const keyDates = []
  if (tender.briefingDate) {
    keyDates.push({ label: 'Briefing', date: tender.briefingDate, time: tender.briefingTime })
  }
  if (tender.closingDate) {
    keyDates.push({ label: 'Closing', date: tender.closingDate })
  }
  if (tender.publishedDate) {
    keyDates.push({ label: 'Published', date: tender.publishedDate })
  }

  const recommendedFor = []
  if (tender.briefingCompulsory) recommendedFor.push('SMEs needing briefing attendance support')
  if (tender.industrySector && tender.industrySector !== 'General Goods and Services') {
    recommendedFor.push(`${tender.industrySector} suppliers`)
  }
  if (tender.opportunityScore >= 70) recommendedFor.push('High-priority opportunities')

  const summary = [
    `${tender.title} (${tender.tenderNumber || tender.ocid})`,
    tender.department ? `Issued by ${tender.department}.` : '',
    tender.briefingCompulsory
      ? `Compulsory briefing on ${tender.briefingDate || 'TBC'} at ${tender.briefingVenue || 'venue TBC'}.`
      : 'Review briefing requirements in tender documents.',
    tender.closingDate ? `Closes ${tender.closingDate}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    summary,
    requirements,
    risks,
    keyDates,
    recommendedFor,
    aiProvider: 'rule-based',
  }
}

async function generateWithOpenAI(tender, apiKey) {
  const prompt = `Summarize this South African government tender briefing for an SME bidder.
Title: ${tender.title}
Description: ${tender.description}
Department: ${tender.department}
Province: ${tender.province}
Briefing: ${tender.briefingCompulsory ? 'Compulsory' : 'Optional'} on ${tender.briefingDate} at ${tender.briefingVenue}
Closing: ${tender.closingDate}

Return JSON with keys: summary (string), requirements (array), risks (array), keyDates (array of {label,date}), recommendedFor (array).`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a procurement analyst for South African SMEs.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  const parsed = JSON.parse(content)
  return { ...parsed, aiProvider: 'openai' }
}

async function generateSummary(tender) {
  const apiKey = process.env.OPENAI_API_KEY

  if (apiKey) {
    try {
      const ai = await generateWithOpenAI(tender, apiKey)
      return {
        ...tender,
        summary: ai.summary || tender.summary,
        requirements: ai.requirements || tender.requirements,
        risks: ai.risks || tender.risks,
        keyDates: ai.keyDates || tender.keyDates,
        recommendedFor: ai.recommendedFor || tender.recommendedFor,
        aiProvider: ai.aiProvider,
      }
    } catch (error) {
      console.warn('OpenAI summary failed, using rule-based:', error.message)
    }
  }

  const rules = ruleBasedSummary(tender)
  return {
    ...tender,
    summary: rules.summary,
    requirements: rules.requirements,
    risks: rules.risks,
    keyDates: rules.keyDates,
    recommendedFor: rules.recommendedFor,
    aiProvider: rules.aiProvider,
  }
}

module.exports = {
  ruleBasedSummary,
  generateSummary,
}
