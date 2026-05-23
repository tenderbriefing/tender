function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

function scoreTender(tender) {
  let score = 0

  if (tender.briefingCompulsory) score += 25
  if ((tender.industryConfidence || 0) >= 0.6) score += 10
  if (tender.province) score += 10

  const closingDays = daysUntil(tender.closingDate)
  if (closingDays !== null) {
    if (closingDays >= 0 && closingDays <= 7) score += 20
    else if (closingDays > 7 && closingDays <= 21) score += 15
    else if (closingDays > 21) score += 8
  }

  const docCount = (tender.documents || []).length
  if (docCount >= 3) score += 10
  else if (docCount >= 1) score += 6

  if (tender.briefingVenue && tender.briefingDate) score += 12
  else if (tender.briefingVenue || tender.briefingDate) score += 6

  if (tender.status === 'active') score += 8
  if (tender.meetingLink) score += 3

  const complexityPenalty =
    (tender.requirements || []).length > 8 ? 8 : (tender.requirements || []).length > 4 ? 4 : 0
  const smeBonus =
    tender.industrySector &&
    !['Construction', 'Civil Engineering'].includes(tender.industrySector)
      ? 6
      : 2

  score += smeBonus
  score -= complexityPenalty

  score = Math.max(0, Math.min(100, Math.round(score)))

  return {
    ...tender,
    opportunityScore: score,
  }
}

module.exports = {
  scoreTender,
  daysUntil,
}
