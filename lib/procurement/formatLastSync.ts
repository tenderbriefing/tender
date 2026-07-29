/** Format last eTender sync for trust strips / headers (en-ZA, Africa/Johannesburg). */

export function formatLastSyncLabel(lastSync?: string | null): string | null {
  if (!lastSync) return null
  const date = new Date(lastSync)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  })
}

export function syncAgeMinutes(lastSync?: string | null): number | null {
  if (!lastSync) return null
  const date = new Date(lastSync)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))
}

/** True when last sync is older than expected 15-minute cadence (+ buffer). */
export function isSyncStale(lastSync?: string | null, thresholdMinutes = 45): boolean {
  const age = syncAgeMinutes(lastSync)
  if (age == null) return true
  return age > thresholdMinutes
}
