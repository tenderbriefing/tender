function normalizeWords(text: string): string[] {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase().replace(/[^\w\s'-]/g, ''))
}

/**
 * Merge adjacent chunk transcripts, removing overlap duplication (design §5).
 * Preserves legitimate repeated speech when overlap is < 3 words.
 */
export function mergeAdjacentChunkTexts(left: string, right: string): string {
  const leftWords = normalizeWords(left)
  const rightWords = normalizeWords(right)
  if (!leftWords.length) return right.trim()
  if (!rightWords.length) return left.trim()

  const maxOverlap = Math.min(leftWords.length, rightWords.length, 40)
  let best = 0
  for (let size = maxOverlap; size >= 3; size -= 1) {
    const leftTail = leftWords.slice(-size).join(' ')
    const rightHead = rightWords.slice(0, size).join(' ')
    if (leftTail === rightHead) {
      best = size
      break
    }
  }

  const dedupedRight = best > 0 ? rightWords.slice(best).join(' ') : right.trim()
  return `${left.trim()} ${dedupedRight}`.trim()
}

export function assembleChunkTexts(chunks: Array<{ index: number; text: string }>): string {
  const sorted = [...chunks].sort((a, b) => a.index - b.index)
  if (!sorted.length) return ''
  let merged = sorted[0].text
  for (let i = 1; i < sorted.length; i += 1) {
    merged = mergeAdjacentChunkTexts(merged, sorted[i].text)
  }
  return merged.trim()
}
