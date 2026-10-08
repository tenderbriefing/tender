/**
 * Allowlist sanitizer for Founder outreach composer HTML.
 * No scripts, event handlers, or javascript: URLs.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
])

function escapeText(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeHref(raw: string): string | null {
  const href = String(raw || '').trim()
  if (!href) return null
  const lower = href.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return null
  }
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:')) {
    return href.slice(0, 2000)
  }
  if (href.startsWith('/') && !href.startsWith('//')) {
    return href.slice(0, 2000)
  }
  return null
}

/** Very small HTML tokenizer sufficient for composer output. */
export function sanitizeComposerHtml(dirty: string): string {
  const input = String(dirty || '')
  if (!input.trim()) return ''

  let out = ''
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input))) {
    if (m[3] != null) {
      out += escapeText(m[3])
      continue
    }
    const tag = String(m[1] || '').toLowerCase()
    const isClose = m[0].startsWith('</')
    if (!ALLOWED_TAGS.has(tag)) continue
    if (isClose) {
      if (tag !== 'br') out += `</${tag}>`
      continue
    }
    if (tag === 'br') {
      out += '<br />'
      continue
    }
    if (tag === 'a') {
      const hrefMatch = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[2] || '')
      const rawHref = hrefMatch?.[2] || hrefMatch?.[3] || hrefMatch?.[4] || ''
      const href = safeHref(rawHref)
      if (!href) {
        out += '<span>'
        continue
      }
      out += `<a href="${escapeText(href)}" target="_blank" rel="noopener noreferrer">`
      continue
    }
    out += `<${tag}>`
  }
  return out
}

export function htmlToPlainText(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-3]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
