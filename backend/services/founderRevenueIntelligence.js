/**
 * Founder Phase D — revenue intelligence aggregation.
 * Authoritative contract: docs/analytics/revenue-funnel-specification.md
 *
 * Payment truth: attendanceRequests.paymentStatus === 'paid' only.
 * Pre-booking stages are prospective since 2026-10-p1-funnel-v1 / 2026-10-06 SAST.
 */

const { sastDayKeyFromIso } = require('../utils/sastDay')

const FUNNEL_INSTRUMENTATION_VERSION = '2026-10-p1-funnel-v1'
const FUNNEL_BOUNDARY_SAST = '2026-10-06'
/** Start of instrumentation-effective SAST calendar day. */
const FUNNEL_BOUNDARY_MS = new Date(`${FUNNEL_BOUNDARY_SAST}T00:00:00+02:00`).getTime()

const EVENT_LIMIT = 1500
const PERIOD_DAYS = { '7': 7, '30': 30, '90': 90, all: null }

function periodStartMs(period, nowMs) {
  const days = PERIOD_DAYS[period]
  if (!days) return null
  return nowMs - days * 86400000
}

function paidAmountCents(request) {
  const amount = Number(request.paymentAmount)
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  const snap = Number(request.briefingPriceCents)
  if (Number.isFinite(snap) && snap > 0) return Math.round(snap)
  const quoted = Number(request.quotedFee)
  if (Number.isFinite(quoted) && quoted > 0) return Math.round(quoted)
  return null
}

function isPaid(request) {
  return request && request.paymentStatus === 'paid'
}

function parseMs(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

function inWindow(iso, startMs, endMs) {
  const t = parseMs(iso)
  if (t == null) return false
  if (startMs != null && t < startMs) return false
  if (endMs != null && t > endMs) return false
  return true
}

/**
 * Prospective stage availability for a Founder period.
 * Pre-boundary absence must never render as zero demand.
 */
function prospectiveAvailability(periodStart, periodEndMs) {
  const end = periodEndMs == null ? Date.now() : periodEndMs
  const start = periodStart == null ? null : periodStart
  if (end < FUNNEL_BOUNDARY_MS) {
    return {
      status: 'unavailable',
      label: 'Unavailable',
      note: `Not instrumented before ${FUNNEL_BOUNDARY_SAST} SAST (${FUNNEL_INSTRUMENTATION_VERSION}).`,
      effectiveStartMs: null,
    }
  }
  const effectiveStart = start == null ? FUNNEL_BOUNDARY_MS : Math.max(start, FUNNEL_BOUNDARY_MS)
  // All-time (null start) and any window that begins before the boundary include
  // uninstrumented history — never present those stages as fully Measured.
  if (start == null || start < FUNNEL_BOUNDARY_MS) {
    return {
      status: 'prospective_partial',
      label: 'Prospective (since instrumentation)',
      note: `Counts only from ${FUNNEL_BOUNDARY_SAST} SAST onward within this period.`,
      effectiveStartMs: effectiveStart,
    }
  }
  return {
    status: 'measured',
    label: 'Measured',
    note: null,
    effectiveStartMs: effectiveStart,
  }
}

function requestIdFromCheckoutEvent(event) {
  const meta = event && event.metadata
  if (meta && typeof meta.requestId === 'string' && meta.requestId.trim()) {
    return meta.requestId.trim()
  }
  if (event && typeof event.targetEntityId === 'string' && event.targetEntityId.trim()) {
    return event.targetEntityId.trim()
  }
  return null
}

function uniqueCheckoutStats(events) {
  const ids = new Set()
  let missing = 0
  let attempts = 0
  for (const e of events) {
    attempts += 1
    const id = requestIdFromCheckoutEvent(e)
    if (!id) {
      missing += 1
      continue
    }
    ids.add(id)
  }
  return {
    attemptCount: attempts,
    uniqueBookingCount: ids.size,
    missingRequestIdCount: missing,
    uniqueRequestIds: Array.from(ids),
  }
}

function conversion(fromVolume, toVolume, fromStatus, toStatus) {
  if (fromStatus === 'unavailable' || toStatus === 'unavailable') {
    return {
      rate: null,
      pctLabel: 'Unavailable',
      absoluteDrop: null,
      reason: 'measurement_limitation',
    }
  }
  if (fromVolume == null || toVolume == null) {
    return {
      rate: null,
      pctLabel: 'Unavailable',
      absoluteDrop: null,
      reason: 'measurement_limitation',
    }
  }
  if (fromVolume === 0) {
    return {
      rate: null,
      pctLabel: 'Insufficient data',
      absoluteDrop: 0,
      reason: 'zero_denominator',
    }
  }
  const rate = toVolume / fromVolume
  return {
    rate,
    pctLabel: `${Math.round(rate * 1000) / 10}%`,
    absoluteDrop: Math.max(0, fromVolume - toVolume),
    reason: 'measured',
  }
}

function isReportDeliveredPartial(request, biByRequestId) {
  const bi = biByRequestId.get(request.id)
  if (bi && (String(bi.status) === 'delivered' || bi.deliveredAt)) {
    return { delivered: true, evidence: 'briefing_intelligence' }
  }
  // Legacy/proxy signals — not fully authoritative
  if (request.reportSubmittedAt || request.reportId || request.reportSlaStatus === 'submitted') {
    return { delivered: true, evidence: 'legacy_proxy' }
  }
  if (request.reportDeliveredAt) {
    return { delivered: true, evidence: 'request_field_unreliable' }
  }
  return { delivered: false, evidence: null }
}

function buildTenderIntelligence({
  requests,
  detailEvents,
  intentEvents,
  checkoutEvents,
  startMs,
  endMs,
  biByRequestId = new Map(),
}) {
  const byTender = new Map()

  for (const e of detailEvents) {
    const tid = (e.metadata && e.metadata.tenderId) || e.targetEntityId
    if (!tid) continue
    const cur = byTender.get(tid) || {
      tenderId: tid,
      detailViews: 0,
      bookingIntent: 0,
      checkoutUnique: 0,
      paidBookings: 0,
      revenueCents: 0,
      amountUnresolved: 0,
      paidAwaitingReport: 0,
      title: null,
    }
    cur.detailViews += 1
    byTender.set(tid, cur)
  }
  for (const e of intentEvents) {
    const tid = (e.metadata && e.metadata.tenderId) || e.targetEntityId
    if (!tid) continue
    const cur = byTender.get(tid) || {
      tenderId: tid,
      detailViews: 0,
      bookingIntent: 0,
      checkoutUnique: 0,
      paidBookings: 0,
      revenueCents: 0,
      amountUnresolved: 0,
      paidAwaitingReport: 0,
      title: null,
    }
    cur.bookingIntent += 1
    byTender.set(tid, cur)
  }

  const checkoutByTender = new Map()
  for (const e of checkoutEvents) {
    const tid = (e.metadata && e.metadata.tenderId) || null
    const rid = requestIdFromCheckoutEvent(e)
    if (!tid || !rid) continue
    if (!checkoutByTender.has(tid)) checkoutByTender.set(tid, new Set())
    checkoutByTender.get(tid).add(rid)
  }
  for (const [tid, set] of checkoutByTender.entries()) {
    const cur = byTender.get(tid) || {
      tenderId: tid,
      detailViews: 0,
      bookingIntent: 0,
      checkoutUnique: 0,
      paidBookings: 0,
      revenueCents: 0,
      amountUnresolved: 0,
      paidAwaitingReport: 0,
      title: null,
    }
    cur.checkoutUnique = set.size
    byTender.set(tid, cur)
  }

  for (const r of requests) {
    if (!isPaid(r)) continue
    if (!inWindow(r.paidAt || r.createdAt, startMs, endMs)) continue
    const tid = r.tenderId
    if (!tid) continue
    const cur = byTender.get(tid) || {
      tenderId: tid,
      detailViews: 0,
      bookingIntent: 0,
      checkoutUnique: 0,
      paidBookings: 0,
      revenueCents: 0,
      amountUnresolved: 0,
      paidAwaitingReport: 0,
      title: r.tenderTitle || r.tenderNumber || null,
    }
    cur.paidBookings += 1
    cur.title = cur.title || r.tenderTitle || r.tenderNumber || null
    const cents = paidAmountCents(r)
    if (cents == null) cur.amountUnresolved += 1
    else cur.revenueCents += cents
    const delivery = isReportDeliveredPartial(r, biByRequestId)
    if (!delivery.delivered) cur.paidAwaitingReport += 1
    byTender.set(tid, cur)
  }

  const rows = Array.from(byTender.values())
  const topByPaid = [...rows]
    .filter((r) => r.paidBookings > 0)
    .sort((a, b) => b.paidBookings - a.paidBookings || b.revenueCents - a.revenueCents)
    .slice(0, 8)
  const topByRevenue = [...rows]
    .filter((r) => r.revenueCents > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 8)
  const highViewLowIntent = [...rows]
    .filter((r) => r.detailViews >= 3 && r.bookingIntent === 0)
    .sort((a, b) => b.detailViews - a.detailViews)
    .slice(0, 8)
  const highIntentLowCheckout = [...rows]
    .filter((r) => r.bookingIntent >= 2 && r.checkoutUnique === 0)
    .sort((a, b) => b.bookingIntent - a.bookingIntent)
    .slice(0, 8)
  const checkoutLowPayment = [...rows]
    .filter((r) => r.checkoutUnique >= 2 && r.paidBookings === 0)
    .sort((a, b) => b.checkoutUnique - a.checkoutUnique)
    .slice(0, 8)
  const paidAwaitingReport = [...rows]
    .filter((r) => r.paidAwaitingReport > 0)
    .sort((a, b) => b.paidAwaitingReport - a.paidAwaitingReport)
    .slice(0, 8)

  return {
    topByPaid,
    topByRevenue,
    highViewLowIntent,
    highIntentLowCheckout,
    checkoutLowPayment,
    paidAwaitingReport,
  }
}

/**
 * Pure aggregation — testable without Firestore.
 */
function computeRevenueIntelligence({
  period = '30',
  nowMs = Date.now(),
  requests = [],
  discoveryEvents = [],
  detailEvents = [],
  intentEvents = [],
  checkoutEvents = [],
  biReports = [],
} = {}) {
  const startMs = periodStartMs(period, nowMs)
  const endMs = nowMs
  const avail = prospectiveAvailability(startMs, endMs)
  const eventWindowStart = avail.effectiveStartMs

  const filterEvents = (list) => {
    if (avail.status === 'unavailable') return []
    return list.filter((e) => inWindow(e.timestamp, eventWindowStart, endMs))
  }

  const discovery = filterEvents(discoveryEvents)
  const detail = filterEvents(detailEvents)
  const intent = filterEvents(intentEvents)
  // Checkout is server behavioural from instrumentation — same prospective boundary
  // (events only exist from Phase C onward).
  const checkout = filterEvents(checkoutEvents)
  const checkoutStats = uniqueCheckoutStats(checkout)

  const paidInPeriod = requests.filter(
    (r) => isPaid(r) && inWindow(r.paidAt || r.createdAt, startMs, endMs)
  )

  let revenueCents = 0
  let amountUnresolved = 0
  for (const r of paidInPeriod) {
    const cents = paidAmountCents(r)
    if (cents == null) amountUnresolved += 1
    else revenueCents += cents
  }

  const biByRequestId = new Map()
  for (const rep of biReports) {
    if (rep && rep.requestId) biByRequestId.set(rep.requestId, rep)
  }

  let reportDelivered = 0
  let reportDeliveredLegacyProxy = 0
  let paidAwaitingReport = 0
  for (const r of paidInPeriod) {
    const d = isReportDeliveredPartial(r, biByRequestId)
    if (d.delivered) {
      reportDelivered += 1
      if (d.evidence !== 'briefing_intelligence') reportDeliveredLegacyProxy += 1
    } else {
      paidAwaitingReport += 1
    }
  }

  const stage = (id, label, volume, statusObj, quality = 'authoritative') => ({
    id,
    label,
    volume: statusObj.status === 'unavailable' ? null : volume,
    displayVolume:
      statusObj.status === 'unavailable' ? 'Unavailable' : String(volume),
    availability: statusObj.status,
    availabilityLabel: statusObj.label,
    note: statusObj.note,
    quality,
  })

  // Checkout/paid/report are reconstructible historically for paid path;
  // checkout_started events are still prospective (only since instrumentation).
  const checkoutAvail = avail // events only exist post-boundary
  const paidAvail = { status: 'measured', label: 'Measured', note: null }
  const reportAvail = {
    status: 'partial',
    label: 'Partially reconstructible',
    note: 'REPORT_DELIVERED mixes BI deliveredAt with legacy proxies — not fully authoritative.',
  }

  const stages = [
    stage('discovery', 'Discovery', discovery.length, avail, 'prospective'),
    stage('tender_detail', 'Tender detail', detail.length, avail, 'prospective'),
    stage('booking_intent', 'Booking intent', intent.length, avail, 'prospective'),
    stage(
      'checkout',
      'Unique bookings reaching checkout',
      checkoutStats.uniqueBookingCount,
      checkoutAvail,
      'prospective'
    ),
    stage('paid', 'Paid bookings', paidInPeriod.length, paidAvail, 'authoritative'),
    stage('report_delivered', 'Report delivered', reportDelivered, reportAvail, 'partial'),
  ]

  const pairs = [
    ['discovery', 'tender_detail', 'Discovery → Tender detail'],
    ['tender_detail', 'booking_intent', 'Tender detail → Booking intent'],
    ['booking_intent', 'checkout', 'Booking intent → Checkout'],
    ['checkout', 'paid', 'Checkout → Paid'],
    ['paid', 'report_delivered', 'Paid → Report delivered'],
  ]

  const byId = Object.fromEntries(stages.map((s) => [s.id, s]))
  const leakage = pairs.map(([fromId, toId, label]) => {
    const from = byId[fromId]
    const to = byId[toId]
    const conv = conversion(from.volume, to.volume, from.availability, to.availability)
    return {
      from: fromId,
      to: toId,
      label,
      fromVolume: from.volume,
      toVolume: to.volume,
      ...conv,
      kind: conv.reason === 'measured' ? 'measured_drop' : 'measurement_limitation',
    }
  })

  const measuredDrops = leakage.filter((l) => l.kind === 'measured_drop' && l.absoluteDrop != null)
  const largestLeak = measuredDrops.sort((a, b) => (b.absoluteDrop || 0) - (a.absoluteDrop || 0))[0] || null

  const resolvedPaid = paidInPeriod.length - amountUnresolved
  const avgResolved =
    resolvedPaid > 0 ? Math.round(revenueCents / resolvedPaid) : null

  const paymentConversion = conversion(
    checkoutStats.uniqueBookingCount,
    paidInPeriod.length,
    checkoutAvail.status,
    'measured'
  )

  const tenderIntel = buildTenderIntelligence({
    requests,
    detailEvents: detail,
    intentEvents: intent,
    checkoutEvents: checkout,
    startMs,
    endMs,
    biByRequestId,
  })

  return {
    instrumentationVersion: FUNNEL_INSTRUMENTATION_VERSION,
    instrumentationBoundarySast: FUNNEL_BOUNDARY_SAST,
    period,
    generatedAt: new Date(nowMs).toISOString(),
    scorecard: {
      revenueCollectedCents: revenueCents,
      paidBookings: paidInPeriod.length,
      averageResolvedRevenueCents: avgResolved,
      paidAmountUnresolved: amountUnresolved,
      checkoutAttempts: checkoutStats.attemptCount,
      uniqueBookingsReachingCheckout: checkoutStats.uniqueBookingCount,
      paymentConversionPctLabel: paymentConversion.pctLabel,
      paymentConversionReason: paymentConversion.reason,
      reportDelivered,
      reportDeliveredQuality: 'partial',
      paidAwaitingReport,
      reportDeliveredLegacyProxyCount: reportDeliveredLegacyProxy,
    },
    funnel: {
      stages,
      checkoutAttempts: checkoutStats.attemptCount,
      uniqueBookingsReachingCheckout: checkoutStats.uniqueBookingCount,
    },
    leakage: {
      largest: largestLeak,
      stages: leakage,
    },
    tenders: tenderIntel,
    trustNotes: [
      'PAID revenue uses paymentAmount → briefingPriceCents → quotedFee; missing amounts count as PAID — AMOUNT UNRESOLVED at R0.',
      `DISCOVERY / TENDER_DETAIL / BOOKING_INTENT are prospective since ${FUNNEL_BOUNDARY_SAST} SAST (${FUNNEL_INSTRUMENTATION_VERSION}). Pre-boundary periods show Unavailable — not zero.`,
      'UNIQUE BOOKINGS REACHING CHECKOUT uses distinct requestId; CHECKOUT ATTEMPTS are raw checkout_started events.',
      'REPORT_DELIVERED is partially reconstructible (BI delivered preferred; legacy proxies labelled).',
    ],
  }
}

async function loadProductEventsByName(db, eventName, sinceIso, limit = EVENT_LIMIT) {
  try {
    let query = db.collection('productEvents').where('eventName', '==', eventName)
    if (sinceIso) {
      query = query.where('timestamp', '>=', sinceIso)
    }
    const snap = await query.orderBy('timestamp', 'desc').limit(limit).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error(
      '[founderRevenueIntelligence] productEvents query failed:',
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
    return []
  }
}

async function loadBiReports(storage, limit = 500) {
  try {
    if (storage && typeof storage.getBriefingIntelligenceReports === 'function') {
      return await storage.getBriefingIntelligenceReports({ limit })
    }
  } catch {
    /* fall through */
  }
  try {
    const { getFirestore } = require('../config/firebaseAdmin')
    const db = getFirestore()
    const snap = await db.collection('briefingIntelligenceReports').limit(limit).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch {
    return []
  }
}

async function buildRevenueIntelligenceForOverview({
  period,
  nowMs,
  requests,
  storage,
}) {
  const { getFirestore } = require('../config/firebaseAdmin')
  const db = getFirestore()
  const avail = prospectiveAvailability(periodStartMs(period, nowMs), nowMs)
  // Load from boundary (or period start if later) to avoid pre-instrumentation noise
  const sinceMs =
    avail.effectiveStartMs != null
      ? avail.effectiveStartMs
      : FUNNEL_BOUNDARY_MS
  const sinceIso = new Date(Math.min(sinceMs, nowMs)).toISOString()

  const [discoveryEvents, detailEvents, intentEvents, checkoutEvents, biReports] =
    await Promise.all([
      loadProductEventsByName(db, 'tender_listing_viewed', sinceIso),
      loadProductEventsByName(db, 'tender_opened', sinceIso),
      loadProductEventsByName(db, 'booking_intent', sinceIso),
      loadProductEventsByName(db, 'checkout_started', sinceIso),
      loadBiReports(storage),
    ])

  return computeRevenueIntelligence({
    period,
    nowMs,
    requests,
    discoveryEvents,
    detailEvents,
    intentEvents,
    checkoutEvents,
    biReports,
  })
}

module.exports = {
  FUNNEL_INSTRUMENTATION_VERSION,
  FUNNEL_BOUNDARY_SAST,
  FUNNEL_BOUNDARY_MS,
  paidAmountCents,
  prospectiveAvailability,
  uniqueCheckoutStats,
  requestIdFromCheckoutEvent,
  conversion,
  computeRevenueIntelligence,
  buildRevenueIntelligenceForOverview,
  periodStartMs,
  sastDayKeyFromIso,
}
