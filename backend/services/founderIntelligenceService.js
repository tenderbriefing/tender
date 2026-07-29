const { getFirestore } = require('../config/firebaseAdmin')

// Engagement classification (keep in sync with lib/founder/engagement.ts)
function daysBetweenJs(fromIso, to = new Date()) {
  if (!fromIso) return null
  const t = new Date(fromIso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((to.getTime() - t) / 86400000)
}

function classify(input) {
  const daysSinceReg = daysBetweenJs(input.registeredAt) ?? 9999
  const daysSinceActive = daysBetweenJs(input.lastMeaningfulAt)
  if (!input.onboardingCompleted && daysSinceReg <= 60) return 'onboarding'
  if (daysSinceReg <= 7) return 'new'
  if (daysSinceActive == null) return daysSinceReg > 30 ? 'dormant' : 'exploring'
  if (input.wasDormantBefore && daysSinceActive <= 14) return 're_engaged'
  if (daysSinceActive > 30) return 'dormant'
  if (daysSinceActive >= 14 && daysSinceActive <= 30) return 'at_risk'
  if (daysSinceActive <= 14 && input.sessionCount >= 3 && input.meaningfulEventCount >= 5) {
    return 'highly_active'
  }
  if (daysSinceActive <= 14) return input.meaningfulEventCount > 0 ? 'active' : 'exploring'
  return 'exploring'
}

function toIso(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value.toDate) return value.toDate().toISOString()
  if (value._seconds) return new Date(value._seconds * 1000).toISOString()
  return null
}

function pickPhone(data) {
  return String(
    data.whatsAppNumber || data.whatsappNumber || data.phoneNumber || data.phone || ''
  ).trim()
}

function startOfDayIso(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

function pct(n, d) {
  if (!d) return null
  return Math.round((n / d) * 1000) / 10
}

async function buildFounderIntelligence({ page = 1, pageSize = 25, role = 'all', q = '', province = '' } = {}) {
  const db = getFirestore()
  const cappedSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100)
  const pageNum = Math.max(Number(page) || 1, 1)

  const [usersSnap, smesSnap, agentsSnap, requestsSnap, summariesSnap, workspaceSnap] =
    await Promise.all([
      db.collection('users').get(),
      db.collection('smes').get(),
      db.collection('agents').get(),
      db.collection('attendanceRequests').get(),
      db.collection('userActivitySummaries').get(),
      db.collection('smeWorkspace').get(),
    ])

  const smeById = new Map(smesSnap.docs.map((d) => [d.id, d.data()]))
  const agentById = new Map(agentsSnap.docs.map((d) => [d.id, d.data()]))
  const summaryById = new Map(summariesSnap.docs.map((d) => [d.id, d.data()]))
  const workspaceById = new Map(workspaceSnap.docs.map((d) => [d.id, d.data()]))

  const requests = requestsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const agentAssignments = new Map() // agentId -> smeIds
  const smeAgents = new Map() // smeId -> agentIds
  for (const r of requests) {
    const agentId = r.assignedAgentId || r.agentId
    if (!agentId || !r.smeId) continue
    if (!agentAssignments.has(agentId)) agentAssignments.set(agentId, new Set())
    agentAssignments.get(agentId).add(r.smeId)
    if (!smeAgents.has(r.smeId)) smeAgents.set(r.smeId, new Set())
    smeAgents.get(r.smeId).add(agentId)
  }

  const smes = []
  const agents = []
  const seenSme = new Set()
  const seenAgent = new Set()
  const todayStart = startOfDayIso()

  for (const doc of usersSnap.docs) {
    const data = doc.data()
    const summary = summaryById.get(doc.id) || {}
    if (data.userType === 'sme') {
      const roleDoc = smeById.get(doc.id) || {}
      const merged = { ...roleDoc, ...data }
      const ws = workspaceById.get(doc.id) || {}
      const registeredAt = toIso(merged.createdAt) || toIso(merged.onboardingCompletedAt)
      const lastMeaningfulAt = toIso(summary.lastMeaningfulAt) || toIso(merged.updatedAt)
      const engagement = classify({
        registeredAt,
        lastMeaningfulAt,
        onboardingCompleted: merged.onboardingCompleted === true,
        meaningfulEventCount: Number(summary.meaningfulEventCount || 0),
        sessionCount: Number(summary.sessionCount || 0),
      })
      const assigned = Array.from(smeAgents.get(doc.id) || [])
      seenSme.add(doc.id)
      smes.push({
        id: doc.id,
        role: 'sme',
        displayName: String(merged.displayName || merged.contactPerson || ''),
        companyName: String(merged.companyName || ''),
        email: String(merged.email || ''),
        phone: pickPhone(merged),
        province: String(merged.province || merged.location || ''),
        city: String(merged.city || ''),
        municipality: null,
        industry: Array.isArray(merged.categories) ? merged.categories[0] || '' : '',
        categories: Array.isArray(merged.categories) ? merged.categories : [],
        csdNumber: String(merged.csdNumber || ''),
        registeredAt,
        daysOnPlatform: daysBetweenJs(registeredAt),
        lastMeaningfulAt,
        lastSeenAt: toIso(summary.lastSeenAt) || lastMeaningfulAt,
        sessionCount: Number(summary.sessionCount || 0),
        meaningfulEventCount: Number(summary.meaningfulEventCount || 0),
        onboardingCompleted: merged.onboardingCompleted === true,
        profileCompletionPct: profileCompletionSme(merged),
        accountStatus: 'active',
        assignedAgentIds: assigned,
        assignedAgentCount: assigned.length,
        tendersSaved: Array.isArray(ws.savedTenderIds)
          ? ws.savedTenderIds.length
          : Array.isArray(ws.savedTenders)
            ? ws.savedTenders.length
            : 0,
        tendersTracked: Array.isArray(ws.trackedTenderIds) ? ws.trackedTenderIds.length : 0,
        attendanceRequests: requests.filter((r) => r.smeId === doc.id).length,
        lastEventName: summary.lastEventName || null,
        engagement,
        risk: engagement === 'at_risk' || engagement === 'dormant' ? engagement : 'none',
      })
    } else if (data.userType === 'youth-agent') {
      const roleDoc = agentById.get(doc.id) || {}
      const merged = { ...data, ...roleDoc }
      const registeredAt = toIso(merged.createdAt) || toIso(merged.onboardingCompletedAt)
      const lastMeaningfulAt = toIso(summary.lastMeaningfulAt) || toIso(merged.updatedAt)
      const engagement = classify({
        registeredAt,
        lastMeaningfulAt,
        onboardingCompleted: merged.onboardingCompleted === true,
        meaningfulEventCount: Number(summary.meaningfulEventCount || 0),
        sessionCount: Number(summary.sessionCount || 0),
      })
      const portfolio = Array.from(agentAssignments.get(doc.id) || [])
      seenAgent.add(doc.id)
      agents.push({
        id: doc.id,
        role: 'youth-agent',
        displayName: String(merged.displayName || merged.name || merged.fullName || ''),
        email: String(merged.email || ''),
        phone: pickPhone(merged),
        province: String(merged.province || merged.location || ''),
        city: String(merged.city || ''),
        municipality: null,
        registeredAt,
        daysOnPlatform: daysBetweenJs(registeredAt),
        lastMeaningfulAt,
        lastSeenAt: toIso(summary.lastSeenAt) || lastMeaningfulAt,
        sessionCount: Number(summary.sessionCount || 0),
        meaningfulEventCount: Number(summary.meaningfulEventCount || 0),
        onboardingCompleted: merged.onboardingCompleted === true,
        verificationStatus: String(merged.verificationStatus || 'pending'),
        agentStatus: mapAgentStatus(merged),
        assignedSmeIds: portfolio,
        assignedSmeCount: portfolio.length,
        completedBriefingCount: Number(merged.completedBriefingCount || 0),
        acceptedBriefingCount: Number(merged.acceptedBriefingCount || 0),
        reliabilityScore: Number(merged.reliabilityScore ?? 100),
        lastEventName: summary.lastEventName || null,
        engagement,
        performance: performanceBand(merged, portfolio.length),
      })
    }
  }

  for (const doc of smesSnap.docs) {
    if (seenSme.has(doc.id)) continue
  }
  for (const doc of agentsSnap.docs) {
    if (seenAgent.has(doc.id)) continue
  }

  const filterList = (list) => {
    const qq = String(q || '').toLowerCase().trim()
    return list.filter((row) => {
      if (province && row.province !== province) return false
      if (!qq) return true
      return (
        String(row.displayName || '').toLowerCase().includes(qq) ||
        String(row.companyName || '').toLowerCase().includes(qq) ||
        String(row.email || '').toLowerCase().includes(qq)
      )
    })
  }

  const filteredSmes = filterList(smes).sort(
    (a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0)
  )
  const filteredAgents = filterList(agents).sort(
    (a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0)
  )

  const slicePage = (list) => {
    const start = (pageNum - 1) * cappedSize
    return {
      items: list.slice(start, start + cappedSize),
      total: list.length,
      page: pageNum,
      pageSize: cappedSize,
      totalPages: Math.max(1, Math.ceil(list.length / cappedSize)),
    }
  }

  const newSmesToday = smes.filter((s) => s.registeredAt && s.registeredAt >= todayStart).length
  const newAgentsToday = agents.filter((a) => a.registeredAt && a.registeredAt >= todayStart).length
  const activeSmesToday = smes.filter((s) => s.lastSeenAt && s.lastSeenAt >= todayStart).length
  const activeAgentsToday = agents.filter((a) => a.lastSeenAt && a.lastSeenAt >= todayStart).length
  const inactiveUsers =
    smes.filter((s) => s.engagement === 'dormant' || s.engagement === 'at_risk').length +
    agents.filter((a) => a.engagement === 'dormant' || a.engagement === 'at_risk').length

  const provinceCounts = {}
  for (const s of smes) {
    const p = s.province || 'Unknown'
    provinceCounts[p] = provinceCounts[p] || { smes: 0, agents: 0 }
    provinceCounts[p].smes += 1
  }
  for (const a of agents) {
    const p = a.province || 'Unknown'
    provinceCounts[p] = provinceCounts[p] || { smes: 0, agents: 0 }
    provinceCounts[p].agents += 1
  }

  const avgDays = (list) => {
    const vals = list.map((x) => x.daysOnPlatform).filter((n) => typeof n === 'number')
    if (!vals.length) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  const onboardedSmes = smes.filter((s) => s.onboardingCompleted).length
  const actions = buildActionCentre(smes, agents, requests)

  const network = {
    smesWithoutAgents: smes.filter((s) => s.assignedAgentCount === 0).length,
    agentsWithoutSmes: agents.filter((a) => a.assignedSmeCount === 0).length,
    pairs: requests
      .filter((r) => r.smeId && (r.assignedAgentId || r.agentId))
      .slice(0, 100)
      .map((r) => ({
        requestId: r.id,
        smeId: r.smeId,
        agentId: r.assignedAgentId || r.agentId,
        status: r.status,
        province: r.province || null,
        createdAt: toIso(r.createdAt),
      })),
  }

  return {
    overview: {
      totalRegistered: smes.length + agents.length,
      totalSmes: smes.length,
      totalYouthAgents: agents.length,
      newSmesToday,
      newYouthAgentsToday: newAgentsToday,
      activeSmesToday,
      activeYouthAgentsToday: activeAgentsToday,
      inactiveUsers,
      usersByProvince: provinceCounts,
      averageDaysOnPlatform: {
        all: avgDays([...smes, ...agents]),
        smes: avgDays(smes),
        agents: avgDays(agents),
      },
      averageSessionDuration: null,
      registrationCompletionRate: {
        smes: pct(onboardedSmes, smes.length),
        agents: pct(
          agents.filter((a) => a.onboardingCompleted).length,
          agents.length
        ),
      },
      comparisons: {
        note: 'Day/7d/30d deltas require productEvents history; Phase 1 shows absolute counts.',
      },
    },
    smes: slicePage(filteredSmes),
    agents: slicePage(filteredAgents),
    network,
    geography: Object.entries(provinceCounts).map(([name, counts]) => ({
      province: name,
      smes: counts.smes,
      agents: counts.agents,
      ratio:
        counts.agents === 0
          ? counts.smes > 0
            ? null
            : 0
          : Math.round((counts.smes / counts.agents) * 10) / 10,
      unassignedSmes: smes.filter((s) => s.province === name && s.assignedAgentCount === 0)
        .length,
    })),
    actions,
    generatedAt: new Date().toISOString(),
    dataNotes: [
      'Municipality is not collected — shown as null.',
      'Agent–SME links derived from attendanceRequests (not permanent portfolios).',
      'Engagement uses userActivitySummaries + profile timestamps until productEvents mature.',
      'Average session duration unavailable until session telemetry accumulates.',
    ],
  }
}

function profileCompletionSme(merged) {
  const fields = [
    merged.companyName,
    merged.province,
    merged.phoneNumber || merged.whatsAppNumber,
    Array.isArray(merged.categories) && merged.categories.length,
    merged.csdNumber,
  ]
  const filled = fields.filter(Boolean).length
  return pct(filled, fields.length) ?? 0
}

function mapAgentStatus(merged) {
  const v = String(merged.verificationStatus || 'pending')
  if (v === 'suspended') return 'Suspended'
  if (v === 'verified' || merged.verified === true) return 'Active'
  return 'Pending Verification'
}

function performanceBand(merged, portfolioSize) {
  const completed = Number(merged.completedBriefingCount || 0)
  if (portfolioSize === 0 && completed === 0) return 'no_portfolio'
  if (completed >= 5) return 'strong'
  if (completed >= 1) return 'developing'
  return 'early'
}

function buildActionCentre(smes, agents, requests) {
  const items = []
  const neverReturned = smes.filter(
    (s) => s.engagement === 'dormant' || (!s.lastMeaningfulAt && (s.daysOnPlatform || 0) > 7)
  )
  if (neverReturned.length) {
    items.push({
      id: 'sme-inactive',
      audience: 'sme',
      priority: 'high',
      title: 'Inactive or never-returned SMEs',
      why: 'No meaningful activity beyond the dormant/at-risk threshold.',
      suggestedAction: 'Offer onboarding call or WhatsApp check-in.',
      affectedCount: neverReturned.length,
      sampleIds: neverReturned.slice(0, 8).map((s) => s.id),
      generatedAt: new Date().toISOString(),
      reviewed: false,
      resolved: false,
    })
  }
  const incomplete = smes.filter((s) => !s.onboardingCompleted)
  if (incomplete.length) {
    items.push({
      id: 'sme-incomplete-onboarding',
      audience: 'sme',
      priority: 'medium',
      title: 'SMEs with incomplete onboarding',
      why: 'onboardingCompleted is false on the user/SME profile.',
      suggestedAction: 'Send onboarding completion guidance.',
      affectedCount: incomplete.length,
      sampleIds: incomplete.slice(0, 8).map((s) => s.id),
      generatedAt: new Date().toISOString(),
      reviewed: false,
      resolved: false,
    })
  }
  const noAgent = smes.filter((s) => s.assignedAgentCount === 0)
  if (noAgent.length) {
    items.push({
      id: 'sme-unassigned',
      audience: 'sme',
      priority: 'medium',
      title: 'SMEs without Youth Agent assistance history',
      why: 'No attendanceRequests linking an agent to this SME.',
      suggestedAction: 'Review whether agent matching should be offered (not assumed).',
      affectedCount: noAgent.length,
      sampleIds: noAgent.slice(0, 8).map((s) => s.id),
      generatedAt: new Date().toISOString(),
      reviewed: false,
      resolved: false,
    })
  }
  const pendingAgents = agents.filter((a) => a.verificationStatus === 'pending')
  if (pendingAgents.length) {
    items.push({
      id: 'agent-pending-verification',
      audience: 'youth-agent',
      priority: 'high',
      title: 'Youth Agents awaiting verification',
      why: 'verificationStatus is pending.',
      suggestedAction: 'Complete verification review.',
      affectedCount: pendingAgents.length,
      sampleIds: pendingAgents.slice(0, 8).map((a) => a.id),
      generatedAt: new Date().toISOString(),
      reviewed: false,
      resolved: false,
    })
  }
  const inactiveAgents = agents.filter(
    (a) => (a.engagement === 'dormant' || a.engagement === 'at_risk') && a.assignedSmeCount > 0
  )
  if (inactiveAgents.length) {
    items.push({
      id: 'agent-inactive-with-portfolio',
      audience: 'youth-agent',
      priority: 'high',
      title: 'Inactive agents with assigned briefings history',
      why: 'Agent engagement is at risk/dormant while holding SME request history.',
      suggestedAction: 'Check capacity and reassign open requests if needed.',
      affectedCount: inactiveAgents.length,
      sampleIds: inactiveAgents.slice(0, 8).map((a) => a.id),
      generatedAt: new Date().toISOString(),
      reviewed: false,
      resolved: false,
    })
  }
  return items
}

async function getUserDetail(uid) {
  const db = getFirestore()
  const [userDoc, summaryDoc, eventsSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('userActivitySummaries').doc(uid).get(),
    db
      .collection('productEvents')
      .where('actorUserId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
      .catch(() => ({ docs: [] })),
  ])
  if (!userDoc.exists) return null
  const data = userDoc.data()
  const roleDoc =
    data.userType === 'sme'
      ? (await db.collection('smes').doc(uid).get()).data() || {}
      : data.userType === 'youth-agent'
        ? (await db.collection('agents').doc(uid).get()).data() || {}
        : {}
  const requests = (
    await db.collection('attendanceRequests').where('smeId', '==', uid).limit(50).get()
  ).docs.map((d) => ({ id: d.id, ...d.data() }))
  const agentRequests =
    data.userType === 'youth-agent'
      ? (
          await db
            .collection('attendanceRequests')
            .where('assignedAgentId', '==', uid)
            .limit(50)
            .get()
            .catch(async () =>
              db.collection('attendanceRequests').where('agentId', '==', uid).limit(50).get()
            )
        ).docs.map((d) => ({ id: d.id, ...d.data() }))
      : []

  return {
    user: { id: uid, ...data, ...roleDoc },
    summary: summaryDoc.exists ? summaryDoc.data() : null,
    timeline: eventsSnap.docs.map((d) => d.data()),
    attendanceRequests: data.userType === 'sme' ? requests : agentRequests,
  }
}

module.exports = {
  buildFounderIntelligence,
  getUserDetail,
  classify,
}
