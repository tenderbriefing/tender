/**
 * Founder Dashboard V2 — bounded executive metrics.
 *
 * Payment truth remains attendanceRequests.paymentStatus === 'paid' (PayFast ITN).
 * Do not infer paid from booking creation. Do not scan unbounded collections.
 * Lifetime SME / Youth Agent / paid totals use Firestore count() aggregations.
 * Period, chart, directories, and Needs Attention use bounded cohorts.
 */

const { getFirestore } = require('../config/firebaseAdmin')
const { getStorage } = require('./storageAdapter')
const {
  isEffectiveTestAccount,
  resolveAccountScope,
  filterByAccountScope,
} = require('../../lib/domain/testAccount')

const REQUEST_COHORT_LIMIT = 500
const PROFILE_COHORT_LIMIT = 800
const REPORT_COHORT_LIMIT = 500
const PAGE_SIZE_MAX = 50
const ATTENTION_CAP = 25
const CACHE_TTL_MS = Number(process.env.FOUNDER_DASHBOARD_CACHE_TTL_MS || 20000)
const { resolveYouthAgentPayoutCents } = require('../constants/briefingPricing')
const YA_PAYOUT_CENTS = resolveYouthAgentPayoutCents()
const NEEDS_ATTENTION_EMPTY = 'Nothing requires your attention.'

const PERIOD_DAYS = { '7': 7, '30': 30, '90': 90, all: null }

function toIso(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value.toDate) return value.toDate().toISOString()
  if (value._seconds) return new Date(value._seconds * 1000).toISOString()
  return null
}

function parseDate(value) {
  const iso = toIso(value)
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function resolvePeriod(raw) {
  const key = String(raw || '30')
  if (key === 'all' || key === '7' || key === '90' || key === '30') return key
  return '30'
}

function periodStartMs(period, now = Date.now()) {
  const days = PERIOD_DAYS[period]
  if (!days) return null
  return now - days * 86400000
}

function inPeriod(iso, startMs) {
  if (startMs == null) return true
  const d = parseDate(iso)
  if (!d) return false
  return d.getTime() >= startMs
}

function isPaidBooking(request) {
  return request && request.paymentStatus === 'paid'
}

/**
 * Authoritative amount on a paid record. Missing amounts are not invented as
 * bookings × current list price; callers may count those rows separately.
 */
function paidAmountCents(request) {
  const amount = Number(request.paymentAmount)
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  const quoted = Number(request.quotedFee)
  if (Number.isFinite(quoted) && quoted > 0) return Math.round(quoted)
  return null
}

function isCancelled(request) {
  return request && request.status === 'cancelled'
}

function isCompletedWorkflow(request) {
  return request && request.status === 'completed'
}

function isUpcomingPaid(request, nowMs) {
  if (!isPaidBooking(request) || isCancelled(request)) return false
  const d = parseDate(request.briefingDate)
  if (!d) return false
  return d.getTime() > nowMs
}

function assignedAgentId(request) {
  return request.assignedAgentId || request.agentId || null
}

function hasReportDelivered(request) {
  return Boolean(
    request.reportDeliveredAt ||
      request.reportSubmittedAt ||
      request.reportId ||
      request.reportSlaStatus === 'submitted'
  )
}

function presentationalLifecycle(request) {
  if (isCancelled(request)) {
    return { key: 'cancelled', label: 'Cancelled' }
  }
  if (!isPaidBooking(request)) {
    return { key: 'unpaid', label: unpaidLabel(request) }
  }
  if (hasReportDelivered(request)) {
    return { key: 'report_delivered', label: 'Report Delivered' }
  }
  const status = String(request.status || '')
  if (status === 'completed' || status === 'closed' || status === 'arrived' || status === 'in_progress') {
    return { key: 'attended', label: 'Attended' }
  }
  if (assignedAgentId(request) || ['assigned', 'accepted', 'en_route'].includes(status)) {
    return { key: 'agent_assigned', label: 'Agent Assigned' }
  }
  return { key: 'paid', label: 'Paid' }
}

function unpaidLabel(request) {
  const p = String(request.paymentStatus || 'pending')
  if (p === 'failed') return 'Payment failed'
  if (p === 'cancelled') return 'Payment cancelled'
  if (p === 'not_required') return 'Not required'
  return 'Unpaid'
}

function paginate(list, page, pageSize) {
  const cappedSize = Math.min(Math.max(Number(pageSize) || 25, 1), PAGE_SIZE_MAX)
  const pageNum = Math.max(Number(page) || 1, 1)
  const start = (pageNum - 1) * cappedSize
  return {
    items: list.slice(start, start + cappedSize),
    total: list.length,
    page: pageNum,
    pageSize: cappedSize,
    totalPages: Math.max(1, Math.ceil(list.length / cappedSize) || 1),
  }
}

function matchesQuery(row, q) {
  const qq = String(q || '')
    .toLowerCase()
    .trim()
  if (!qq) return true
  return Object.values(row).some((v) => String(v || '').toLowerCase().includes(qq))
}

function dayKey(iso) {
  const d = parseDate(iso)
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

function utcDayKeyFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

function buildActivitySeries({ smeRegs, yaRegs, paidAtList, period, nowMs }) {
  const startMs = periodStartMs(period, nowMs)
  const endKey = utcDayKeyFromMs(nowMs)
  const startKey =
    startMs == null
      ? utcDayKeyFromMs(earliestDay(smeRegs, yaRegs, paidAtList, nowMs).getTime())
      : utcDayKeyFromMs(startMs)

  const days = []
  let cursor = new Date(`${startKey}T00:00:00.000Z`)
  const end = new Date(`${endKey}T00:00:00.000Z`)
  let guard = 0
  while (cursor.getTime() <= end.getTime() && guard < 90) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 86400000)
    guard += 1
  }
  if (!days.length) {
    days.push(endKey)
  }

  const sme = countByDay(smeRegs)
  const ya = countByDay(yaRegs)
  const paid = countByDay(paidAtList)
  return days.map((date) => ({
    date,
    smeRegistrations: sme[date] || 0,
    youthAgentRegistrations: ya[date] || 0,
    paidBookings: paid[date] || 0,
  }))
}

function earliestDay(a, b, c, nowMs) {
  const all = [...a, ...b, ...c].map(parseDate).filter(Boolean)
  if (!all.length) return new Date(nowMs - 29 * 86400000)
  const min = Math.min(...all.map((d) => d.getTime()))
  const floor = nowMs - 89 * 86400000
  return new Date(Math.max(min, floor))
}

function countByDay(isoList) {
  const map = {}
  for (const iso of isoList) {
    const key = dayKey(iso)
    if (!key) continue
    map[key] = (map[key] || 0) + 1
  }
  return map
}

function computeOverviewMetrics({
  smeTotal,
  agentTotal,
  paidTotal,
  completedTotal,
  requests,
  period,
  nowMs,
}) {
  const startMs = periodStartMs(period, nowMs)
  const paidInPeriod = requests.filter(
    (r) => isPaidBooking(r) && inPeriod(r.paidAt || r.createdAt, startMs)
  )
  const revenueCents = paidInPeriod.reduce((sum, r) => {
    const cents = paidAmountCents(r)
    return cents == null ? sum : sum + cents
  }, 0)
  const upcoming = requests.filter((r) => isUpcomingPaid(r, nowMs)).length
  const completedInPeriod = requests.filter((r) => {
    if (!isCompletedWorkflow(r)) return false
    return inPeriod(r.briefingDate || r.updatedAt || r.paidAt, startMs)
  }).length

  const paidInCohort = requests.filter(isPaidBooking).length
  return {
    smes: smeTotal,
    youthAgents: agentTotal,
    paidBookings: period === 'all' ? paidTotal : paidInPeriod.length,
    revenueCents,
    upcomingBriefings: upcoming,
    completedBriefings: period === 'all' ? completedTotal : completedInPeriod,
    paidInPeriodCount: paidInPeriod.length,
    paidWithoutAmount: paidInPeriod.filter((r) => paidAmountCents(r) == null).length,
    revenueCohortIncomplete: period === 'all' && paidTotal > paidInCohort,
  }
}

function buildNeedsAttention(requests, reportsByRequestId = new Map()) {
  const items = []
  const seen = new Set()

  const push = (item) => {
    if (seen.has(item.id) || items.length >= ATTENTION_CAP) return
    seen.add(item.id)
    items.push(item)
  }

  for (const r of requests) {
    if (
      isPaidBooking(r) &&
      r.status === 'pending' &&
      !assignedAgentId(r)
    ) {
      push({
        id: `paid_awaiting_assignment:${r.id}`,
        kind: 'paid_awaiting_assignment',
        title: 'Paid briefing awaiting agent assignment',
        href: `/founder/briefings/${r.id}`,
        recordId: r.id,
        detail: r.tenderTitle || r.tenderNumber || r.smeCompany || null,
      })
    }
  }

  for (const r of requests) {
    if (r.reportSlaStatus === 'overdue') {
      push({
        id: `report_overdue:${r.id}`,
        kind: 'report_overdue',
        title: 'Briefing report overdue',
        href: `/founder/briefings/${r.id}`,
        recordId: r.id,
        detail: r.tenderTitle || r.tenderNumber || null,
      })
    }
  }

  for (const r of requests) {
    if (r.status !== 'completed' && r.status !== 'closed') continue
    const report = reportsByRequestId.get(r.id)
    const hasProof = Boolean(
      report && (report.attendanceProofUrl || report.attendanceConfirmed === true)
    )
    if (!hasProof) {
      push({
        id: `proof_outstanding:${r.id}`,
        kind: 'proof_outstanding',
        title: 'Attendance proof outstanding',
        href: `/founder/briefings/${r.id}`,
        recordId: r.id,
        detail: r.tenderTitle || r.tenderNumber || null,
      })
    }
  }

  for (const r of requests) {
    if (r.paymentStatus === 'failed') {
      push({
        id: `payment_reconciliation:${r.id}`,
        kind: 'payment_reconciliation',
        title: 'Payment requiring reconciliation',
        href: `/founder/briefings/${r.id}`,
        recordId: r.id,
        detail: r.paymentFailureReason || r.tenderNumber || null,
      })
    }
  }

  return items
}

function buildSmeRows({ users, roleDocs, requests, summaries }) {
  const spentBySme = new Map()
  const bookingsBySme = new Map()
  for (const r of requests) {
    if (!r.smeId) continue
    bookingsBySme.set(r.smeId, (bookingsBySme.get(r.smeId) || 0) + (isPaidBooking(r) ? 1 : 0))
    if (isPaidBooking(r)) {
      const cents = paidAmountCents(r)
      if (cents != null) {
        spentBySme.set(r.smeId, (spentBySme.get(r.smeId) || 0) + cents)
      }
    }
  }

  return users.map((u) => {
    const role = roleDocs.get(u.id) || {}
    const summary = summaries.get(u.id) || {}
    const company = String(role.companyName || u.companyName || '').trim()
    const contact = String(
      u.displayName || role.contactPerson || u.contactPerson || u.email || ''
    ).trim()
    const joined = toIso(u.createdAt) || toIso(role.createdAt) || toIso(u.onboardingCompletedAt)
    const lastActive =
      toIso(summary.lastMeaningfulAt) || toIso(summary.lastSeenAt) || toIso(u.updatedAt)
    const testAccount = isEffectiveTestAccount({ ...role, ...u })
    const paidBookings = bookingsBySme.get(u.id) || 0
    const spent = spentBySme.has(u.id) ? spentBySme.get(u.id) : paidBookings === 0 ? 0 : null
    return {
      id: u.id,
      company: company || contact || u.email || u.id,
      contact: contact || '—',
      province: String(u.province || role.province || role.location || u.location || '') || null,
      joined,
      bookings: paidBookings,
      totalSpentCents: spent,
      lastActive,
      isTestAccount: testAccount,
    }
  })
}

function buildAgentRows({ users, roleDocs, requests, reports, payoutsByAgent = new Map() }) {
  const briefingsByAgent = new Map()
  const completedByAgent = new Map()
  const reportsByAgent = new Map()

  for (const r of requests) {
    const aid = assignedAgentId(r)
    if (!aid) continue
    briefingsByAgent.set(aid, (briefingsByAgent.get(aid) || 0) + 1)
    if (isCompletedWorkflow(r)) {
      completedByAgent.set(aid, (completedByAgent.get(aid) || 0) + 1)
    }
  }
  for (const rep of reports) {
    if (!rep.agentId) continue
    reportsByAgent.set(rep.agentId, (reportsByAgent.get(rep.agentId) || 0) + 1)
  }

  return users.map((u) => {
    const role = roleDocs.get(u.id) || {}
    const name = String(
      u.displayName || role.displayName || role.name || role.fullName || u.email || ''
    ).trim()
    const joined = toIso(u.createdAt) || toIso(role.createdAt) || toIso(u.onboardingCompletedAt)
    const completed = completedByAgent.get(u.id) || 0
    const payoutEarnings = payoutsByAgent.get(u.id)
    const hasPayoutEarnings = payoutEarnings != null && payoutEarnings > 0
    return {
      id: u.id,
      agent: name || u.id,
      province: String(u.province || role.province || role.location || u.location || '') || null,
      joined,
      briefings: briefingsByAgent.get(u.id) || 0,
      completed,
      reports: reportsByAgent.get(u.id) || 0,
      earningsCents: hasPayoutEarnings ? payoutEarnings : completed === 0 ? 0 : null,
    }
  })
}

async function loadPayoutEarningsByAgent(limit = 500) {
  const db = getFirestore()
  const snap = await db
    .collection('youthAgentPayouts')
    .limit(limit)
    .get()
    .catch(() => ({ docs: [] }))
  const map = new Map()
  for (const doc of snap.docs) {
    const p = doc.data()
    if (!p || !['eligible', 'held', 'batched', 'settled', 'paid'].includes(p.status)) continue
    const uid = String(p.youthAgentUid || '')
    if (!uid) continue
    const amount = Math.round(Number(p.payoutAmountCents) || YA_PAYOUT_CENTS)
    map.set(uid, (map.get(uid) || 0) + amount)
  }
  return map
}

function buildBriefingPipelineKpis(requests, reportsByRequestId = new Map(), nowMs = Date.now()) {
  const paidUnassigned = requests.filter(
    (r) => isPaidBooking(r) && r.status === 'pending' && !assignedAgentId(r)
  ).length
  const evidenceOutstanding = requests.filter((r) => {
    if (!isPaidBooking(r) || !assignedAgentId(r)) return false
    const report = reportsByRequestId.get(r.id)
    const status = String(report?.status || '')
    return !report || ['pending', 'awaiting_evidence'].includes(status)
  }).length
  const aiAwaitingFounderReview = [...reportsByRequestId.values()].filter((rep) =>
    ['draft_ready', 'awaiting_founder_review', 'pending_approval', 'agent_reviewed'].includes(
      String(rep.status || '')
    )
  ).length
  const approvedAwaitingDelivery = [...reportsByRequestId.values()].filter((rep) => {
    const s = String(rep.status || '')
    return s === 'approved' || (s === 'finalized' && !rep.deliveredAt)
  }).length
  const privateSourceCount = requests.filter(
    (r) => r.source === 'private_tender' || r.privateTenderId
  ).length
  return {
    paidUnassigned,
    evidenceOutstanding,
    aiAwaitingFounderReview,
    approvedAwaitingDelivery,
    privateSourceCount,
    upcomingBriefings: requests.filter((r) => isUpcomingPaid(r, nowMs)).length,
  }
}

function buildBriefingRows(requests) {
  return requests.map((r) => {
    const life = presentationalLifecycle(r)
    const cents = isPaidBooking(r) ? paidAmountCents(r) : paidAmountCents(r)
    const snap = r.briefingSnapshot && typeof r.briefingSnapshot === 'object' ? r.briefingSnapshot : {}
    return {
      id: r.id,
      sme: String(r.smeCompany || r.smeName || r.smeId || '—'),
      tender: String(r.tenderTitle || r.tenderNumber || r.tenderId || '—'),
      tenderNumber: String(r.tenderNumber || ''),
      procuringOrganisation: String(r.department || r.organisationId || '—'),
      briefingDate: toIso(r.briefingDate || snap.briefingDate),
      briefingTime: String(r.briefingTime || snap.briefingStartTime || ''),
      venue: String(r.briefingVenue || snap.briefingVenue || ''),
      province: String(r.province || snap.briefingProvince || ''),
      amountCents: cents,
      paymentStatus: String(r.paymentStatus || 'pending'),
      youthAgent: assignedAgentId(r)
        ? String(r.agentName || assignedAgentId(r))
        : null,
      assignmentStatus: assignedAgentId(r) ? 'assigned' : 'unassigned',
      status: String(r.status || 'pending'),
      lifecycle: life.key,
      lifecycleLabel: life.label,
      source: String(r.source || (r.privateTenderId ? 'private_tender' : 'public_tender')),
      privateTenderId: r.privateTenderId || null,
      organisationId: r.organisationId || null,
    }
  })
}

async function countEq(col, field, value) {
  const db = getFirestore()
  try {
    const snap = await db.collection(col).where(field, '==', value).count().get()
    return snap.data().count
  } catch {
    return 0
  }
}

/** Count users of a type that are classified as test accounts (flag or smoke evidence). */
async function countTestAccountsByType(userType) {
  const db = getFirestore()
  let flagged = 0
  try {
    const snap = await db.collection('users').where('isTestAccount', '==', true).limit(500).get()
    flagged = snap.docs.filter((d) => d.data()?.userType === userType).length
  } catch {
    flagged = 0
  }
  // Also catch untagged smoke emails still missing the flag (pre-migration).
  let heuristic = 0
  try {
    const snap = await db.collection('users').where('userType', '==', userType).limit(PROFILE_COHORT_LIMIT).get()
    heuristic = snap.docs.filter((d) => {
      const data = { id: d.id, ...d.data() }
      if (data.isTestAccount === true) return false
      return isEffectiveTestAccount(data)
    }).length
  } catch {
    heuristic = 0
  }
  return flagged + heuristic
}

async function loadUsersByType(userType, limit) {
  const db = getFirestore()
  const snap = await db.collection('users').where('userType', '==', userType).limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function loadCollectionMap(name, limit) {
  const db = getFirestore()
  const snap = await db.collection(name).limit(limit).get()
  return new Map(snap.docs.map((d) => [d.id, d.data()]))
}

function commercialRequests(requests, usersById, accountScope) {
  const scope = resolveAccountScope(accountScope)
  if (scope === 'all') return requests
  return requests.filter((r) => {
    if (r.isTestData === true) return scope === 'test'
    const sme = usersById.get(r.smeId)
    const isTest = sme ? isEffectiveTestAccount(sme) : false
    return scope === 'test' ? isTest : !isTest
  })
}

async function loadOverview(period, nowMs, accountScope = 'real') {
  const scope = resolveAccountScope(accountScope)
  const storage = getStorage()
  const [smeTotalRaw, agentTotalRaw, , , requests, smeUsersRaw, yaUsersRaw, reports] =
    await Promise.all([
      countEq('users', 'userType', 'sme'),
      countEq('users', 'userType', 'youth-agent'),
      countEq('attendanceRequests', 'paymentStatus', 'paid'),
      countEq('attendanceRequests', 'status', 'completed'),
      storage.getAttendanceRequests({ limit: REQUEST_COHORT_LIMIT }),
      loadUsersByType('sme', 400),
      loadUsersByType('youth-agent', 400),
      storage.getBriefingReports({ limit: REPORT_COHORT_LIMIT }),
    ])

  const [testSmeCount, testAgentCount] = await Promise.all([
    countTestAccountsByType('sme'),
    countTestAccountsByType('youth-agent'),
  ])

  const smeUsers = filterByAccountScope(smeUsersRaw, scope)
  const yaUsers = filterByAccountScope(yaUsersRaw, scope)
  const usersById = new Map(smeUsersRaw.map((u) => [u.id, u]))
  const scopedRequests = commercialRequests(requests, usersById, scope)

  let smeTotal = smeTotalRaw
  let agentTotal = agentTotalRaw
  if (scope === 'real') {
    smeTotal = Math.max(0, smeTotalRaw - testSmeCount)
    agentTotal = Math.max(0, agentTotalRaw - testAgentCount)
  } else if (scope === 'test') {
    smeTotal = testSmeCount
    agentTotal = testAgentCount
  }

  const kpis = computeOverviewMetrics({
    smeTotal,
    agentTotal,
    paidTotal: scopedRequests.filter(isPaidBooking).length,
    completedTotal: scopedRequests.filter(isCompletedWorkflow).length,
    requests: scopedRequests,
    period,
    nowMs,
  })
  // Prefer scoped cohort totals for All Time when excluding test accounts
  // (global count aggregations still include smoke bookings).
  if (scope !== 'all' && period === 'all') {
    kpis.paidBookings = scopedRequests.filter(isPaidBooking).length
    kpis.completedBriefings = scopedRequests.filter(isCompletedWorkflow).length
  }

  const startMs = periodStartMs(period, nowMs)
  const smeRegs = smeUsers
    .map((u) => toIso(u.createdAt) || toIso(u.onboardingCompletedAt))
    .filter((iso) => iso && inPeriod(iso, startMs))
  const yaRegs = yaUsers
    .map((u) => toIso(u.createdAt) || toIso(u.onboardingCompletedAt))
    .filter((iso) => iso && inPeriod(iso, startMs))
  const paidAtList = scopedRequests
    .filter((r) => isPaidBooking(r) && inPeriod(r.paidAt || r.createdAt, startMs))
    .map((r) => r.paidAt || r.createdAt)

  const reportsByRequestId = new Map()
  for (const rep of reports) {
    if (rep.requestId) reportsByRequestId.set(rep.requestId, rep)
  }

  const dataNotes = [
    scope === 'real'
      ? 'SMEs and Youth Agents are lifetime registered-account counts excluding test/smoke accounts (isTestAccount).'
      : scope === 'test'
        ? 'Showing test/smoke accounts only (isTestAccount or certified smoke evidence).'
        : 'Showing all accounts including test/smoke.',
    'Paid Bookings and revenue exclude bookings owned by test SMEs when scope is Real SMEs.',
    'Paid Bookings (All Time) counts attendanceRequests.paymentStatus == paid within the commercial scope. Period views count paidAt within a bounded recent request cohort (≤500).',
    kpis.revenueCohortIncomplete
      ? 'All Time revenue is summed from the bounded paid cohort (≤500), which is smaller than the paid count aggregation — the rand total is a conservative recent-cohort figure, not a silent full-history total.'
      : 'Revenue sums paymentAmount (else quotedFee) on those paid records. Rows without a stored amount are omitted from the sum — not estimated as bookings × current list price.',
    'Upcoming Briefings are currently future paid/valid briefings (briefingDate after now, not cancelled) in the same cohort.',
    'Completed Briefings follow production workflow status == completed (executive analytics).',
    'Business Activity uses bounded recent profiles (≤400 SME, ≤400 Youth Agent) plus the request cohort — not a full historical scan.',
  ]

  return {
    period,
    accountScope: scope,
    kpis: {
      smes: kpis.smes,
      youthAgents: kpis.youthAgents,
      paidBookings: kpis.paidBookings,
      revenueCents: kpis.revenueCents,
      upcomingBriefings: kpis.upcomingBriefings,
      completedBriefings: kpis.completedBriefings,
      ...buildBriefingPipelineKpis(scopedRequests, reportsByRequestId, nowMs),
    },
    activity: buildActivitySeries({ smeRegs, yaRegs, paidAtList, period, nowMs }),
    needsAttention: buildNeedsAttention(scopedRequests, reportsByRequestId),
    generatedAt: new Date(nowMs).toISOString(),
    dataNotes,
    cohortCapped:
      requests.length >= REQUEST_COHORT_LIMIT ||
      smeUsersRaw.length >= 400 ||
      yaUsersRaw.length >= 400,
    testAccountCounts: { smes: testSmeCount, youthAgents: testAgentCount },
  }
}

async function loadSmes({ page, pageSize, q, province, accountScope = 'real' }) {
  const scope = resolveAccountScope(accountScope)
  const storage = getStorage()
  const [usersRaw, roleDocs, requests, summaries] = await Promise.all([
    loadUsersByType('sme', PROFILE_COHORT_LIMIT),
    loadCollectionMap('smes', PROFILE_COHORT_LIMIT),
    storage.getAttendanceRequests({ limit: REQUEST_COHORT_LIMIT }),
    loadCollectionMap('userActivitySummaries', PROFILE_COHORT_LIMIT),
  ])
  const users = filterByAccountScope(usersRaw, scope)
  let rows = buildSmeRows({ users, roleDocs, requests, summaries })
  if (province) rows = rows.filter((r) => r.province === province)
  rows = rows.filter((r) => matchesQuery(r, q))
  rows.sort((a, b) => new Date(b.joined || 0) - new Date(a.joined || 0))
  const pageResult = paginate(rows, page, pageSize)
  return { ...pageResult, accountScope: scope }
}

async function loadAgents({ page, pageSize, q, province, accountScope = 'real' }) {
  const scope = resolveAccountScope(accountScope)
  const storage = getStorage()
  const [usersRaw, roleDocs, requests, reports, payoutsByAgent] = await Promise.all([
    loadUsersByType('youth-agent', PROFILE_COHORT_LIMIT),
    loadCollectionMap('agents', PROFILE_COHORT_LIMIT),
    storage.getAttendanceRequests({ limit: REQUEST_COHORT_LIMIT }),
    storage.getBriefingReports({ limit: REPORT_COHORT_LIMIT }),
    loadPayoutEarningsByAgent(),
  ])
  const users = filterByAccountScope(usersRaw, scope)
  let rows = buildAgentRows({ users, roleDocs, requests, reports, payoutsByAgent })
  if (province) rows = rows.filter((r) => r.province === province)
  rows = rows.filter((r) => matchesQuery(r, q))
  rows.sort((a, b) => new Date(b.joined || 0) - new Date(a.joined || 0))
  const pageResult = paginate(rows, page, pageSize)
  return { ...pageResult, accountScope: scope }
}

async function loadBriefings({ page, pageSize, q, accountScope = 'real' }) {
  const scope = resolveAccountScope(accountScope)
  const storage = getStorage()
  const [requests, smeUsersRaw] = await Promise.all([
    storage.getAttendanceRequests({ limit: REQUEST_COHORT_LIMIT }),
    loadUsersByType('sme', PROFILE_COHORT_LIMIT),
  ])
  const usersById = new Map(smeUsersRaw.map((u) => [u.id, u]))
  const scoped = commercialRequests(requests, usersById, scope)
  let rows = buildBriefingRows(scoped)
  rows = rows.filter((r) => matchesQuery(r, q))
  rows.sort((a, b) => new Date(b.briefingDate || 0) - new Date(a.briefingDate || 0))
  const pageResult = paginate(rows, page, pageSize)
  return { ...pageResult, accountScope: scope }
}

async function loadDetail(kind, id) {
  const db = getFirestore()
  const storage = getStorage()
  if (!id) return null
  if (kind === 'briefing') {
    const snap = await db.collection('attendanceRequests').doc(String(id)).get()
    if (!snap.exists) return null
    const request = { id: snap.id, ...snap.data() }
    let report = null
    try {
      const reportSnap = await db
        .collection('briefingReports')
        .where('requestId', '==', id)
        .limit(5)
        .get()
      report = reportSnap.docs[0] ? { id: reportSnap.docs[0].id, ...reportSnap.docs[0].data() } : null
    } catch {
      report = null
    }
    return {
      kind: 'briefing',
      request,
      report,
      lifecycle: presentationalLifecycle(request),
    }
  }
  const userDoc = await db.collection('users').doc(id).get()
  if (!userDoc.exists) return null
  const data = userDoc.data()
  const roleCol = kind === 'agent' || data.userType === 'youth-agent' ? 'agents' : 'smes'
  const [roleDoc, summaryDoc, requests] = await Promise.all([
    db.collection(roleCol).doc(id).get(),
    db.collection('userActivitySummaries').doc(id).get(),
    kind === 'agent' || data.userType === 'youth-agent'
      ? storage.getAttendanceRequests({ limit: REQUEST_COHORT_LIMIT }).then((list) =>
          list.filter((r) => assignedAgentId(r) === id).slice(0, 50)
        )
      : storage.getAttendanceRequests({ limit: REQUEST_COHORT_LIMIT }).then((list) =>
          list.filter((r) => r.smeId === id).slice(0, 50)
        ),
  ])
  return {
    kind: kind === 'agent' || data.userType === 'youth-agent' ? 'agent' : 'sme',
    user: { id, ...data, ...(roleDoc.exists ? roleDoc.data() : {}) },
    summary: summaryDoc.exists ? summaryDoc.data() : null,
    attendanceRequests: requests,
  }
}

let cacheEntry = null
let cacheAt = 0
let inflight = null

async function getFounderDashboard(opts = {}) {
  const view = opts.view || 'overview'
  const period = resolvePeriod(opts.period)
  const page = Number(opts.page) || 1
  const pageSize = Number(opts.pageSize) || 25
  const q = String(opts.q || '')
  const province = String(opts.province || '')
  const kind = String(opts.kind || '')
  const id = String(opts.id || '')
  const accountScope = resolveAccountScope(opts.accountScope)
  const key = JSON.stringify({ view, period, page, pageSize, q, province, kind, id, accountScope })
  if (cacheEntry && cacheEntry.key === key && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cacheEntry.value
  }
  if (inflight && inflight.key === key) return inflight.promise

  const promise = (async () => {
    const nowMs = Date.now()
    const generatedAt = new Date(nowMs).toISOString()
    if (view === 'smes') {
      return {
        view,
        smes: await loadSmes({ page, pageSize, q, province, accountScope }),
        generatedAt,
      }
    }
    if (view === 'agents') {
      return {
        view,
        agents: await loadAgents({ page, pageSize, q, province, accountScope }),
        generatedAt,
      }
    }
    if (view === 'briefings') {
      return {
        view,
        briefings: await loadBriefings({ page, pageSize, q, accountScope }),
        generatedAt,
      }
    }
    if (view === 'detail') {
      return { view, detail: await loadDetail(kind, id), generatedAt }
    }
    return {
      view: 'overview',
      overview: await loadOverview(period, nowMs, accountScope),
      generatedAt,
    }
  })()
    .then((value) => {
      cacheEntry = { key, value }
      cacheAt = Date.now()
      return value
    })
    .finally(() => {
      inflight = null
    })

  inflight = { key, promise }
  return promise
}

function resetFounderDashboardCacheForTests() {
  cacheEntry = null
  cacheAt = 0
  inflight = null
}

module.exports = {
  REQUEST_COHORT_LIMIT,
  PROFILE_COHORT_LIMIT,
  CACHE_TTL_MS,
  NEEDS_ATTENTION_EMPTY,
  resolvePeriod,
  periodStartMs,
  inPeriod,
  isPaidBooking,
  paidAmountCents,
  isUpcomingPaid,
  isCompletedWorkflow,
  presentationalLifecycle,
  paginate,
  computeOverviewMetrics,
  buildNeedsAttention,
  buildSmeRows,
  buildAgentRows,
  buildBriefingRows,
  buildBriefingPipelineKpis,
  buildActivitySeries,
  getFounderDashboard,
  resetFounderDashboardCacheForTests,
  countTestAccountsByType,
  commercialRequests,
  filterByAccountScope,
}
