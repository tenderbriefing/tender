const TRACKED_FIELDS = [
  'closingDate',
  'briefingDate',
  'briefingVenue',
  'documents',
  'contactPerson',
  'status',
  'briefingCompulsory',
  'meetingLink',
]

function serializeValue(value) {
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value ?? '')
}

function applyHistory(existing, updated) {
  const history = [...(existing?.history || [])]
  const changedAt = new Date().toISOString()

  for (const field of TRACKED_FIELDS) {
    const before = existing?.[field]
    const after = updated[field]

    if (serializeValue(before) !== serializeValue(after)) {
      history.push({
        field,
        from: before ?? null,
        to: after ?? null,
        changedAt,
      })
    }
  }

  return {
    ...updated,
    history: history.slice(-100),
  }
}

function hasChanged(existing, candidate) {
  if (!existing) return true
  return TRACKED_FIELDS.some(
    (field) => serializeValue(existing[field]) !== serializeValue(candidate[field])
  )
}

module.exports = {
  TRACKED_FIELDS,
  applyHistory,
  hasChanged,
}
