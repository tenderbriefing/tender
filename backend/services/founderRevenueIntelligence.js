/**
 * Founder Phase D — revenue intelligence aggregation.
 * Authoritative contract: docs/analytics/revenue-funnel-specification.md
 *
 * Payment truth: attendanceRequests.paymentStatus === 'paid' only.
 * Pre-booking stages are prospective since 2026-10-p1-funnel-v1 / 2026-10-06 SAST.
 *
 * Fail-soft rule: query/index failures MUST NOT render as zero activity.
 * Truncation rule: hitting cohort caps MUST be labelled Partial — never silent completeness.
 */

const { sastDayKeyFromIso } = require('../utils/sastDay')

const FUNNEL_INSTRUMENTATION_VERSION = '2026-10-p1-funnel-v1'
const FUNNEL_BOUNDARY_SAST = '2026-10-06'
/** Start of instrumentation-effective SAST calendar day. */
const FUNNEL_BOUNDARY_MS = new Date(`${FUNNEL_BOUNDARY_SAST}T00:00:00+02:00`).getTime()

const EVENT_LIMIT = 1500
const BI_REPORT_LIMIT = 500
const PERIOD_DAYS = { '7': 7, '30': 30, '90': 90, all: null }

/** Required composite for loadProductEventsByName (eventName + timestamp range/order). */
const REQUIRED_PRODUCT_EVENTS_INDEX = {
  collectionGroup: 'productEvents',
  queryScope: 'COLLECTION',
  fields: [
    { fieldPath: 'eventName', order: 'ASCENDING' },
    { fieldPath: 'timestamp', order: 'DESCENDING' },
  ],
}

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
  if (
    fromStatus === 'unavailable' ||
    toStatus === 'unavailable' ||
    fromStatus === 'query_failed' ||
    toStatus === 'query_failed'
  ) {
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
  if (request.reportSubmittedAt || request.reportId || request.reportSlaStatus === 'submitted') {
    return { delivered: true, evidence: 'legacy_proxy' }
  }
  if (request.reportDeliveredAt) {
    return { delivered: true, evidence: 'request_field_unreliable' }
  }
  return { delivered: false, evidence: null }
}

function emptySourceLoad() {
  return { ok: true, items: [], truncated: false, error: null }
}

function normalizeSourceLoad(load, limit) {
  if (!load || typeof load !== 'object') {
    return emptySourceLoad()
  }
  if (load.ok === false) {
    return {
      ok: false,
      items: [],
      truncated: false,
      error: load.error || 'query_failed',
    }
  }
  const items = Array.isArray(load.items)
    ? load.items
    : Array.isArray(load.events)
      ? load.events
      : Array.isArray(load.reports)
        ? load.reports
        : []
  const truncated =
    load.truncated === true || (Number.isFinite(limit) && items.length >= limit)
  return { ok: true, items, truncated, error: null }
}

/**
 * Merge instrumentation boundary availability with query/truncation health.
 * Query failure always wins over "measured zero".
 */
function resolveStageAvailability(baseAvail, sourceLoad) {
  if (baseAvail.status === 'unavailable') return baseAvail
  if (!sourceLoad || sourceLoad.ok === false) {
    return {
      status: 'unavailable',
      label: 'Measurement unavailable',
      note:
        'productEvents query failed (index/permissions/runtime). This is not evidence of zero activity.',
      effectiveStartMs: baseAvail.effectiveStartMs,
      reason: 'query_failed',
    }
  }
  if (sourceLoad.truncated) {
    return {
      status: 'partial',
      label:
        baseAvail.status === 'prospective_partial'
          ? 'Prospective · truncated'
          : 'Partial (truncated)',
      note: `Event cohort hit the read cap (${EVENT_LIMIT}). Volume is a lower bound — not a complete count.`,
      effectiveStartMs: baseAvail.effectiveStartMs,
      reason: 'truncated',
    }
  }
  return baseAvail
}

function buildTenderIntelligence({
  requests,
  detailEvents,
  intentEvents,
  checkoutEvents,
  startMs,
  endMs,
  biByRequestId = new Map(),
  eventsUsable = true,
}) {
  const byTender = new Map()

  if (eventsUsable) {
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
  const highViewLowIntent = eventsUsable
    ? [...rows]
        .filter((r) => r.detailViews >= 3 && r.bookingIntent === 0)
        .sort((a, b) => b.detailViews - a.detailViews)
        .slice(0, 8)
    : []
  const highIntentLowCheckout = eventsUsable
    ? [...rows]
        .filter((r) => r.bookingIntent >= 2 && r.checkoutUnique === 0)
        .sort((a, b) => b.bookingIntent - a.bookingIntent)
        .slice(0, 8)
    : []
  const checkoutLowPayment = eventsUsable
    ? [...rows]
        .filter((r) => r.checkoutUnique >= 2 && r.paidBookings === 0)
        .sort((a, b) => b.checkoutUnique - a.checkoutUnique)
        .slice(0, 8)
    : []
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
    eventDerivedListsAvailable: eventsUsable,
  }
}

/**
 * Pure aggregation — testable without Firestore.
 */
function computeRevenueIntelligence({
  period = '30',
  nowMs = Date.now(),
  requests = [],
  discoveryEvents,
  detailEvents,
  intentEvents,
  checkoutEvents,
  biReports,
  discoveryLoad,
  detailLoad,
  intentLoad,
  checkoutLoad,
  biLoad,
  requestsCohortTruncated = false,
} = {}) {
  const startMs = periodStartMs(period, nowMs)
  const endMs = nowMs
  const baseAvail = prospectiveAvailability(startMs, endMs)
  const eventWindowStart = baseAvail.effectiveStartMs

  const discoverySrc = normalizeSourceLoad(
    discoveryLoad || { ok: true, events: discoveryEvents || [] },
    EVENT_LIMIT
  )
  const detailSrc = normalizeSourceLoad(
    detailLoad || { ok: true, events: detailEvents || [] },
    EVENT_LIMIT
  )
  const intentSrc = normalizeSourceLoad(
    intentLoad || { ok: true, events: intentEvents || [] },
    EVENT_LIMIT
  )
  const checkoutSrc = normalizeSourceLoad(
    checkoutLoad || { ok: true, events: checkoutEvents || [] },
    EVENT_LIMIT
  )
  const biSrc = normalizeSourceLoad(
    biLoad || { ok: true, reports: biReports || [] },
    BI_REPORT_LIMIT
  )

  const filterEvents = (list, sourceOk) => {
    if (baseAvail.status === 'unavailable') return []
    if (!sourceOk) return []
    return list.filter((e) => inWindow(e.timestamp, eventWindowStart, endMs))
  }

  const discovery = filterEvents(discoverySrc.items, discoverySrc.ok)
  const detail = filterEvents(detailSrc.items, detailSrc.ok)
  const intent = filterEvents(intentSrc.items, intentSrc.ok)
  const checkout = filterEvents(checkoutSrc.items, checkoutSrc.ok)
  const checkoutStats = uniqueCheckoutStats(checkout)

  const discoveryAvail = resolveStageAvailability(baseAvail, discoverySrc)
  const detailAvail = resolveStageAvailability(baseAvail, detailSrc)
  const intentAvail = resolveStageAvailability(baseAvail, intentSrc)
  const checkoutAvail = resolveStageAvailability(baseAvail, checkoutSrc)

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
  if (biSrc.ok) {
    for (const rep of biSrc.items) {
      if (rep && rep.requestId) biByRequestId.set(rep.requestId, rep)
    }
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

  const paidAvail = requestsCohortTruncated
    ? {
        status: 'partial',
        label: 'Partial (request cohort truncated)',
        note: 'Paid metrics use the bounded attendanceRequests cohort (≤500). Hitting the cap means this is a lower-bound recent cohort — not a complete period total.',
      }
    : { status: 'measured', label: 'Measured', note: null }

  const reportAvail = !biSrc.ok
    ? {
        status: 'partial',
        label: 'Partially reconstructible · BI load failed',
        note: 'briefingIntelligenceReports query failed. Delivery uses legacy request proxies only — not fully authoritative.',
      }
    : biSrc.truncated || requestsCohortTruncated
      ? {
          status: 'partial',
          label: 'Partially reconstructible · truncated',
          note: 'REPORT_DELIVERED mixes BI deliveredAt with legacy proxies; cohort caps may omit some reports/requests.',
        }
      : {
          status: 'partial',
          label: 'Partially reconstructible',
          note: 'REPORT_DELIVERED mixes BI deliveredAt with legacy proxies — not fully authoritative.',
        }

  const stage = (id, label, volume, statusObj, quality = 'authoritative') => {
    const failed =
      statusObj.reason === 'query_failed' ||
      (statusObj.status === 'unavailable' && statusObj.label === 'Measurement unavailable')
    const boundaryUnavailable =
      statusObj.status === 'unavailable' && statusObj.label === 'Unavailable'
    const truncated = statusObj.reason === 'truncated'
    let displayVolume
    if (failed || boundaryUnavailable) {
      displayVolume = 'Unavailable'
    } else if (truncated) {
      displayVolume = `≥${volume}`
    } else {
      displayVolume = String(volume)
    }
    return {
      id,
      label,
      volume: failed || boundaryUnavailable ? null : volume,
      displayVolume,
      availability: statusObj.status,
      availabilityLabel: statusObj.label,
      note: statusObj.note,
      quality,
    }
  }

  const stages = [
    stage('discovery', 'Discovery', discovery.length, discoveryAvail, 'prospective'),
    stage('tender_detail', 'Tender detail', detail.length, detailAvail, 'prospective'),
    stage('booking_intent', 'Booking intent', intent.length, intentAvail, 'prospective'),
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
  const largestLeak =
    measuredDrops.sort((a, b) => (b.absoluteDrop || 0) - (a.absoluteDrop || 0))[0] || null

  const resolvedPaid = paidInPeriod.length - amountUnresolved
  const avgResolved = resolvedPaid > 0 ? Math.round(revenueCents / resolvedPaid) : null

  const checkoutQueryFailed = checkoutAvail.reason === 'query_failed'
  const paymentConversion = conversion(
    checkoutQueryFailed ? null : checkoutStats.uniqueBookingCount,
    paidInPeriod.length,
    checkoutAvail.status,
    paidAvail.status
  )

  const eventLoadsOk =
    discoverySrc.ok && detailSrc.ok && intentSrc.ok && checkoutSrc.ok
  const tenderIntel = buildTenderIntelligence({
    requests,
    detailEvents: detail,
    intentEvents: intent,
    checkoutEvents: checkout,
    startMs,
    endMs,
    biByRequestId,
    eventsUsable: eventLoadsOk && baseAvail.status !== 'unavailable',
  })

  const failedQueries = []
  if (!discoverySrc.ok) failedQueries.push('tender_listing_viewed')
  if (!detailSrc.ok) failedQueries.push('tender_opened')
  if (!intentSrc.ok) failedQueries.push('booking_intent')
  if (!checkoutSrc.ok) failedQueries.push('checkout_started')
  if (!biSrc.ok) failedQueries.push('briefingIntelligenceReports')

  const truncatedSources = []
  if (discoverySrc.truncated) truncatedSources.push('tender_listing_viewed')
  if (detailSrc.truncated) truncatedSources.push('tender_opened')
  if (intentSrc.truncated) truncatedSources.push('booking_intent')
  if (checkoutSrc.truncated) truncatedSources.push('checkout_started')
  if (biSrc.truncated) truncatedSources.push('briefingIntelligenceReports')
  if (requestsCohortTruncated) truncatedSources.push('attendanceRequests')

  let measurementStatus = 'ok'
  if (failedQueries.length > 0 || truncatedSources.length > 0) {
    measurementStatus = 'degraded'
  }
  if (baseAvail.status === 'unavailable' && failedQueries.length === 0) {
    measurementStatus = 'boundary_unavailable'
  }

  const trustNotes = [
    'PAID revenue uses paymentAmount → briefingPriceCents → quotedFee; missing amounts count as PAID — AMOUNT UNRESOLVED at R0.',
    `DISCOVERY / TENDER_DETAIL / BOOKING_INTENT follow ${FUNNEL_INSTRUMENTATION_VERSION} / ${FUNNEL_BOUNDARY_SAST} SAST. Pre-boundary shows Unavailable — not zero.`,
    'UNIQUE BOOKINGS REACHING CHECKOUT uses distinct requestId; CHECKOUT ATTEMPTS are raw checkout_started events.',
    'REPORT_DELIVERED is partially reconstructible (BI delivered preferred; legacy proxies labelled).',
    'Query/index failures surface as Measurement unavailable — never as zero activity.',
  ]
  if (failedQueries.length) {
    trustNotes.push(`Failed loads (not zero): ${failedQueries.join(', ')}.`)
  }
  if (truncatedSources.length) {
    trustNotes.push(
      `Truncated cohorts (lower bound, not complete): ${truncatedSources.join(', ')}.`
    )
  }

  return {
    instrumentationVersion: FUNNEL_INSTRUMENTATION_VERSION,
    instrumentationBoundarySast: FUNNEL_BOUNDARY_SAST,
    period,
    generatedAt: new Date(nowMs).toISOString(),
    measurementStatus,
    dataQuality: {
      failedQueries,
      truncatedSources,
      requestsCohortTruncated: Boolean(requestsCohortTruncated),
      biReportsFailed: !biSrc.ok,
      biReportsTruncated: Boolean(biSrc.truncated),
      eventQueryFailed: failedQueries.some((q) => q !== 'briefingIntelligenceReports'),
      zeroMeansMeasured:
        failedQueries.length === 0 && baseAvail.status !== 'unavailable',
    },
    scorecard: {
      revenueCollectedCents: revenueCents,
      paidBookings: paidInPeriod.length,
      paidBookingsComplete: !requestsCohortTruncated,
      averageResolvedRevenueCents: avgResolved,
      paidAmountUnresolved: amountUnresolved,
      checkoutAttempts: checkoutQueryFailed ? null : checkoutStats.attemptCount,
      uniqueBookingsReachingCheckout: checkoutQueryFailed
        ? null
        : checkoutStats.uniqueBookingCount,
      checkoutAttemptsDisplay: checkoutQueryFailed
        ? 'Unavailable'
        : checkoutAvail.reason === 'truncated'
          ? `≥${checkoutStats.attemptCount}`
          : String(checkoutStats.attemptCount),
      uniqueCheckoutDisplay: checkoutQueryFailed
        ? 'Unavailable'
        : checkoutAvail.reason === 'truncated'
          ? `≥${checkoutStats.uniqueBookingCount}`
          : String(checkoutStats.uniqueBookingCount),
      paymentConversionPctLabel: paymentConversion.pctLabel,
      paymentConversionReason: paymentConversion.reason,
      reportDelivered,
      reportDeliveredQuality: 'partial',
      paidAwaitingReport,
      reportDeliveredLegacyProxyCount: reportDeliveredLegacyProxy,
    },
    funnel: {
      stages,
      checkoutAttempts: checkoutQueryFailed ? null : checkoutStats.attemptCount,
      uniqueBookingsReachingCheckout: checkoutQueryFailed
        ? null
        : checkoutStats.uniqueBookingCount,
    },
    leakage: {
      largest: largestLeak,
      stages: leakage,
    },
    tenders: tenderIntel,
    trustNotes,
  }
}

async function loadProductEventsByName(db, eventName, sinceIso, limit = EVENT_LIMIT) {
  try {
    let query = db.collection('productEvents').where('eventName', '==', eventName)
    if (sinceIso) {
      query = query.where('timestamp', '>=', sinceIso)
    }
    const snap = await query.orderBy('timestamp', 'desc').limit(limit).get()
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return {
      ok: true,
      events,
      items: events,
      truncated: events.length >= limit,
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'unknown'
    console.error(
      '[founderRevenueIntelligence] productEvents query failed:',
      eventName,
      message
    )
    return {
      ok: false,
      events: [],
      items: [],
      truncated: false,
      error: message,
    }
  }
}

async function loadBiReports(storage, limit = BI_REPORT_LIMIT) {
  try {
    if (storage && typeof storage.getBriefingIntelligenceReports === 'function') {
      const reports = await storage.getBriefingIntelligenceReports({ limit })
      const list = Array.isArray(reports) ? reports : []
      return {
        ok: true,
        reports: list,
        items: list,
        truncated: list.length >= limit,
        error: null,
      }
    }
  } catch (err) {
    console.error(
      '[founderRevenueIntelligence] BI via storage failed:',
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
  }
  try {
    const { getFirestore } = require('../config/firebaseAdmin')
    const db = getFirestore()
    const snap = await db.collection('briefingIntelligenceReports').limit(limit).get()
    const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return {
      ok: true,
      reports,
      items: reports,
      truncated: reports.length >= limit,
      error: null,
    }
  } catch (err) {
    console.error(
      '[founderRevenueIntelligence] BI query failed:',
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
    return {
      ok: false,
      reports: [],
      items: [],
      truncated: false,
      error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    }
  }
}

async function buildRevenueIntelligenceForOverview({
  period,
  nowMs,
  requests,
  storage,
  requestsCohortTruncated = false,
}) {
  const { getFirestore } = require('../config/firebaseAdmin')
  const db = getFirestore()
  const avail = prospectiveAvailability(periodStartMs(period, nowMs), nowMs)
  const sinceMs =
    avail.effectiveStartMs != null ? avail.effectiveStartMs : FUNNEL_BOUNDARY_MS
  const sinceIso = new Date(Math.min(sinceMs, nowMs)).toISOString()

  const [discoveryLoad, detailLoad, intentLoad, checkoutLoad, biLoad] =
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
    discoveryLoad,
    detailLoad,
    intentLoad,
    checkoutLoad,
    biLoad,
    requestsCohortTruncated,
  })
}

function assertRequiredProductEventsIndex(indexesJson) {
  const indexes = (indexesJson && indexesJson.indexes) || []
  return indexes.some((idx) => {
    if (idx.collectionGroup !== 'productEvents') return false
    if (idx.queryScope !== 'COLLECTION') return false
    const fields = idx.fields || []
    if (fields.length < 2) return false
    return (
      fields[0].fieldPath === 'eventName' &&
      fields[0].order === 'ASCENDING' &&
      fields[1].fieldPath === 'timestamp' &&
      fields[1].order === 'DESCENDING'
    )
  })
}

module.exports = {
  FUNNEL_INSTRUMENTATION_VERSION,
  FUNNEL_BOUNDARY_SAST,
  FUNNEL_BOUNDARY_MS,
  EVENT_LIMIT,
  BI_REPORT_LIMIT,
  REQUIRED_PRODUCT_EVENTS_INDEX,
  paidAmountCents,
  prospectiveAvailability,
  uniqueCheckoutStats,
  requestIdFromCheckoutEvent,
  conversion,
  computeRevenueIntelligence,
  buildRevenueIntelligenceForOverview,
  loadProductEventsByName,
  loadBiReports,
  assertRequiredProductEventsIndex,
  normalizeSourceLoad,
  resolveStageAvailability,
  periodStartMs,
  sastDayKeyFromIso,
}
