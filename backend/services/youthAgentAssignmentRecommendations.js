/**
 * Explainable Youth Agent assignment recommendations (Phase 3C).
 * Founder retains final assignment control — recommendations never auto-assign.
 */
function sliceStr(v, max = 200) {
  return String(v ?? '')
    .trim()
    .slice(0, max)
}

function sameProvince(a, b) {
  return (
    Boolean(a) &&
    Boolean(b) &&
    String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
  )
}

/**
 * @param {object} request attendance request
 * @param {Array<object>} agents youth agent profiles
 * @param {Array<object>} activeAssignments optional overlapping assignments
 * @returns {{ recommendations: Array<object> }}
 */
function recommendYouthAgents(request, agents = [], activeAssignments = []) {
  const province = sliceStr(request.province || request.briefingSnapshot?.briefingProvince, 80)
  const briefingDate = sliceStr(request.briefingDate || request.briefingSnapshot?.briefingDate, 32)
  const municipality = sliceStr(
    request.briefingSnapshot?.briefingMunicipality || request.municipality || '',
    80
  )

  const busyOnDate = new Set()
  for (const a of activeAssignments) {
    const d = sliceStr(a.briefingDate, 32)
    if (d && briefingDate && d === briefingDate && a.assignedAgentId) {
      busyOnDate.add(String(a.assignedAgentId))
    }
  }

  const scored = []
  for (const agent of agents) {
    if (!agent || agent.disabled === true) continue
    const id = String(agent.id || agent.uid || '')
    if (!id) continue

    const reasons = []
    let score = 0

    if (sameProvince(agent.province || agent.location, province)) {
      score += 40
      reasons.push(`${sliceStr(agent.province || agent.location, 40)} agent`)
    }

    if (
      municipality &&
      String(agent.city || agent.preferredServiceAreas || '')
        .toLowerCase()
        .includes(municipality.toLowerCase())
    ) {
      score += 15
      reasons.push(`familiar with ${municipality}`)
    }

    if (briefingDate && busyOnDate.has(id)) {
      // Do not recommend agents already assigned on the briefing date.
      continue
    }
    if (briefingDate) {
      score += 25
      reasons.push('no overlapping assignment on briefing date')
    }

    const reliability = Number(agent.reliabilityScore ?? agent.rating ?? 0)
    if (reliability >= 80 || Number(agent.rating) >= 4) {
      score += 15
      reasons.push('historically reliable')
    } else if (reliability > 0) {
      score += 5
    }

    if (agent.availability === 'available' || agent.verificationStatus === 'verified') {
      score += 10
      reasons.push('available / verified')
    }

    if (score <= 0 || reasons.length === 0) continue

    scored.push({
      agentId: id,
      displayName: sliceStr(agent.displayName || agent.name || agent.fullName || 'Youth Agent', 120),
      province: sliceStr(agent.province || agent.location, 80),
      score,
      reasons,
      explanation: `Recommended because: ${reasons.join('; ')}.`,
    })
  }

  scored.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
  return { recommendations: scored.slice(0, 8) }
}

module.exports = {
  recommendYouthAgents,
}
