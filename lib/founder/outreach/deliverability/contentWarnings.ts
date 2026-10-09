/**
 * Pre-send content warnings for Outreach Composer.
 * Advises Founder — never auto-rewrites authored content.
 */

export type ContentWarningSeverity = 'info' | 'warn' | 'block'

export type ContentWarning = {
  code: string
  severity: ContentWarningSeverity
  message: string
}

export type ContentAnalysis = {
  warnings: ContentWarning[]
  hasBlocking: boolean
  hasTextAlternativeHint: boolean
  subjectLength: number
  linkCount: number
  htmlBytes: number
}

const SUSPICIOUS_SUBJECT =
  /\b(free money|act now|urgent!!!|winner|lottery|crypto giveaway|100% guaranteed)\b/i

export function analyseComposerContent(input: {
  subject: string
  html: string
  text?: string
}): ContentAnalysis {
  const subject = String(input.subject || '').trim()
  const html = String(input.html || '')
  const text = String(input.text || '').trim()
  const warnings: ContentWarning[] = []

  if (!subject) {
    warnings.push({
      code: 'empty_subject',
      severity: 'block',
      message: 'Subject is required.',
    })
  } else if (subject.length > 120) {
    warnings.push({
      code: 'long_subject',
      severity: 'warn',
      message: 'Subject is longer than 120 characters — some clients truncate aggressively.',
    })
  }

  if (SUSPICIOUS_SUBJECT.test(subject)) {
    warnings.push({
      code: 'risky_subject',
      severity: 'warn',
      message: 'Subject contains phrases commonly associated with spam filters.',
    })
  }

  if (/^\s*(re:|fwd:)/i.test(subject)) {
    warnings.push({
      code: 'misleading_subject_prefix',
      severity: 'warn',
      message: 'Subject starts with Re:/Fwd: — avoid unless this is a true reply/forward.',
    })
  }

  const links = html.match(/https?:\/\/[^\s"'<>]+/gi) || []
  const uniqueLinks = [...new Set(links)]
  if (uniqueLinks.length > 12) {
    warnings.push({
      code: 'many_links',
      severity: 'warn',
      message: `Email contains ${uniqueLinks.length} unique links — consider reducing for deliverability.`,
    })
  }

  const offDomain = uniqueLinks.filter((u) => {
    try {
      const host = new URL(u).hostname.toLowerCase()
      return !host.endsWith('tenderbriefing.co.za') && !host.endsWith('tenderbriefing.com')
    } catch {
      return true
    }
  })
  if (offDomain.length > 0) {
    warnings.push({
      code: 'external_links',
      severity: 'info',
      message: `${offDomain.length} link(s) point outside tenderbriefing.co.za — ensure destinations are trusted.`,
    })
  }

  if (/javascript:|data:text\/html/i.test(html)) {
    warnings.push({
      code: 'dangerous_url_scheme',
      severity: 'block',
      message: 'HTML contains javascript: or data: URL schemes which must not be sent.',
    })
  }

  if (/<script/i.test(html)) {
    warnings.push({
      code: 'script_tag',
      severity: 'block',
      message: 'HTML still contains a script tag after sanitization expectations — do not send.',
    })
  }

  const plainFromHtml = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text && plainFromHtml.length < 20) {
    warnings.push({
      code: 'thin_body',
      severity: 'warn',
      message: 'Body appears very short — thin content can hurt inbox placement.',
    })
  }

  if (!/unsubscribe/i.test(html) && !/unsubscribe/i.test(text)) {
    warnings.push({
      code: 'missing_unsubscribe_visible',
      severity: 'warn',
      message:
        'No visible unsubscribe wording detected in body. Production render should still append footer + List-Unsubscribe headers.',
    })
  }

  if (html.length > 100_000) {
    warnings.push({
      code: 'large_html',
      severity: 'warn',
      message: 'HTML payload is very large (>100KB) — may trigger clipping or spam heuristics.',
    })
  }

  return {
    warnings,
    hasBlocking: warnings.some((w) => w.severity === 'block'),
    hasTextAlternativeHint: Boolean(text) || plainFromHtml.length > 0,
    subjectLength: subject.length,
    linkCount: uniqueLinks.length,
    htmlBytes: Buffer.byteLength(html, 'utf8'),
  }
}
