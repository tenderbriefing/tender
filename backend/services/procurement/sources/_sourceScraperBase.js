/**
 * Shared HTML fetch + notice discovery for municipal/SOE scrapers.
 * Regex-based (no cheerio) for Next.js API route compatibility.
 */

const USER_AGENT = 'TenderBriefing/1.0 (+https://tenderbriefing.co.za; procurement-intelligence)'

async function fetchHtml(url, timeoutMs = 25000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return { ok: false, status: res.status, html: '', error: `HTTP ${res.status}` }
    const html = await res.text()
    return { ok: true, status: res.status, html }
  } catch (err) {
    return { ok: false, html: '', error: err instanceof Error ? err.message : 'fetch_failed' }
  }
}

function stripTags(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function discoverNotices(html, baseUrl, sourceId) {
  const notices = []
  const seen = new Set()
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = linkRegex.exec(html || '')) !== null) {
    const href = match[1]
    const title = stripTags(match[2])
    if (!title || title.length < 8) continue
    const lower = title.toLowerCase()
    const looksLikeTender =
      /tender|rfq|bid|quotation|scm|procurement|briefing|site meeting|clarification/i.test(
        lower
      ) || href.toLowerCase().includes('.pdf')
    if (!looksLikeTender) continue

    let absolute = href
    try {
      absolute = new URL(href, baseUrl).toString()
    } catch {
      continue
    }
    if (seen.has(absolute)) continue
    seen.add(absolute)

    notices.push({
      source: sourceId,
      title,
      url: absolute,
      isPdf: absolute.toLowerCase().includes('.pdf'),
    })
  }

  return notices.slice(0, 40)
}

function extractBriefingHints(text = '') {
  const compulsory =
    /compulsory\s+(briefing|site|inspection|meeting)/i.test(text) ||
    /mandatory\s+(briefing|site|meeting)/i.test(text)
  const hasBriefing =
    compulsory ||
    /briefing session|clarification meeting|site visit|bidders meeting|technical briefing/i.test(
      text
    )
  const venueMatch = text.match(
    /(?:venue|location|address)[:\s]+([^\n\r.]{8,120})/i
  )
  const dateMatch = text.match(
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/g
  )
  return {
    compulsoryBriefing: compulsory,
    hasBriefingSignal: hasBriefing,
    briefingVenue: venueMatch ? venueMatch[1].trim() : null,
    briefingDate: dateMatch ? dateMatch[0] : null,
  }
}

function buildNormalizedRecord(source, notice, extra = {}) {
  const hints = extractBriefingHints(`${notice.title} ${extra.description || ''}`)
  return {
    source: source.id,
    sourceName: source.name,
    tenderNumber: extra.tenderNumber || `${source.id}-${Buffer.from(notice.url).toString('base64url').slice(0, 12)}`,
    title: notice.title,
    description: extra.description || notice.title,
    department: extra.department || source.name,
    province: extra.province || source.province || 'Unknown',
    closingDate: extra.closingDate || null,
    briefingDate: extra.briefingDate || hints.briefingDate,
    briefingVenue: extra.briefingVenue || hints.briefingVenue,
    compulsoryBriefing: extra.compulsoryBriefing ?? hints.compulsoryBriefing,
    category: source.category,
    cidbGrade: extra.cidbGrade || null,
    attachments: notice.isPdf ? [{ url: notice.url, type: 'pdf' }] : [],
    aiInsights: null,
    rawSourceData: {
      url: notice.url,
      scrapedAt: new Date().toISOString(),
      htmlSnippet: (extra.htmlSnippet || '').slice(0, 2000),
    },
  }
}

async function runGenericSourceScraper(source, paths = ['/']) {
  const notices = []
  const errors = []

  for (const path of paths) {
    const url = `${source.baseUrl.replace(/\/$/, '')}${path}`
    const fetched = await fetchHtml(url)
    if (!fetched.ok) {
      errors.push({ url, error: fetched.error })
      continue
    }
    notices.push(...discoverNotices(fetched.html, source.baseUrl, source.id))
  }

  const records = notices.map((n) =>
    buildNormalizedRecord(source, n, { htmlSnippet: n.title })
  )

  return {
    sourceId: source.id,
    ok: records.length > 0 || errors.length === 0,
    records,
    noticesFound: notices.length,
    errors,
    scrapedAt: new Date().toISOString(),
  }
}

module.exports = {
  fetchHtml,
  discoverNotices,
  extractBriefingHints,
  buildNormalizedRecord,
  runGenericSourceScraper,
}
