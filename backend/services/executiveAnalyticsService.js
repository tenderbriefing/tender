/**
 * Executive analytics — platform-wide KPI aggregation.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const { getStorage } = require('./storageAdapter')
const whatsappService = require('./whatsappService')
const workflowAutomationService = require('./workflowAutomationService')

const METRICS_COLLECTION = 'executiveMetrics'

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function minutesBetween(a, b) {
  const t1 = parseDate(a)?.getTime()
  const t2 = parseDate(b)?.getTime()
  if (!t1 || !t2 || t2 < t1) return null
  return (t2 - t1) / 60000
}

async function computeExecutiveMetrics() {
  const storage = getStorage()
  const syncService = require('./incrementalSyncService')
  const [tenders, requests, reports, syncStatus, waStats, workflowTelemetry] =
    await Promise.all([
      storage.getAllTenders(),
      storage.getAttendanceRequests(),
      storage.getBriefingReports(),
      syncService.getSyncStatus(),
      whatsappService.getWhatsAppStats(100),
      workflowAutomationService.getWorkflowTelemetry({ limit: 100 }),
    ])

  const paid = requests.filter((r) => r.paymentStatus === 'paid')
  const pendingPaid = requests.filter(
    (r) => r.status === 'pending' && r.paymentStatus === 'paid'
  )
  const completed = requests.filter((r) => r.status === 'completed')
  const today = new Date().toISOString().slice(0, 10)

  const revenueTodayCents = paid
    .filter((r) => r.paidAt && String(r.paidAt).startsWith(today))
    .reduce((s, r) => s + (r.paymentAmount || 24900), 0)

  const provinceDemand = {}
  const departmentDemand = {}
  const smeCounts = {}

  for (const r of requests) {
    const p = r.province || 'Unknown'
    provinceDemand[p] = (provinceDemand[p] || 0) + 1
    const d = r.department || 'Unknown'
    departmentDemand[d] = (departmentDemand[d] || 0) + 1
    if (r.smeId) smeCounts[r.smeId] = (smeCounts[r.smeId] || 0) + 1
  }

  const dispatchTimes = []
  const reportTimes = []
  for (const r of requests) {
    const dm = minutesBetween(r.paidAt || r.createdAt, r.acceptedAt)
    if (dm !== null) dispatchTimes.push(dm)
  }
  for (const rep of reports) {
    const req = requests.find((x) => x.id === rep.requestId)
    if (req?.briefingDate) {
      const rm = minutesBetween(req.briefingDate, rep.createdAt)
      if (rm !== null) reportTimes.push(rm)
    }
  }

  const slaCompliant = requests.filter(
    (r) => r.acceptedAt && minutesBetween(r.paidAt, r.acceptedAt) !== null && minutesBetween(r.paidAt, r.acceptedAt) <= 60
  ).length

  const conversionPct =
    requests.length > 0 ? Math.round((paid.length / requests.length) * 1000) / 10 : 0

  const waTotal = waStats.sent + waStats.failed + waStats.pending
  const whatsappSuccessRate =
    waTotal > 0 ? Math.round((waStats.sent / waTotal) * 1000) / 10 : null

  const workflowCompleted = workflowTelemetry.byStatus?.completed || 0
  const workflowTotal = workflowTelemetry.total || 0
  const workflowCompletionRate =
    workflowTotal > 0 ? Math.round((workflowCompleted / workflowTotal) * 1000) / 10 : null

  const topSmes = Object.entries(smeCounts)
    .map(([smeId, count]) => {
      const r = requests.find((x) => x.smeId === smeId)
      return { smeId, count, name: r?.smeCompany || r?.smeName || smeId }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    capturedAt: new Date().toISOString(),
    totalTenders: tenders.length,
    activeTenders: tenders.filter((t) => t.status === 'active').length,
    totalRequests: requests.length,
    paidRequests: paid.length,
    pendingPaidRequests: pendingPaid.length,
    completedRequests: completed.length,
    conversionPct,
    revenueTodayCents,
    provinceDemand: Object.entries(provinceDemand)
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count),
    topDepartments: Object.entries(departmentDemand)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topSmes,
    averageDispatchMinutes:
      dispatchTimes.length > 0
        ? Math.round(dispatchTimes.reduce((a, b) => a + b, 0) / dispatchTimes.length)
        : null,
    averageReportUploadMinutes:
      reportTimes.length > 0
        ? Math.round(reportTimes.reduce((a, b) => a + b, 0) / reportTimes.length)
        : null,
    slaCompliancePct:
      paid.length > 0 ? Math.round((slaCompliant / paid.length) * 1000) / 10 : null,
    whatsappSuccessRate,
    paymentConversionPct: conversionPct,
    workflowCompletionRate,
    workflowHealth: workflowTelemetry.byStatus || {},
    syncHealth: syncStatus.apiHealth || 'unknown',
    operationalUptime: syncStatus.apiHealth === 'healthy' ? 'up' : 'degraded',
  }
}

async function saveExecutiveMetricsSnapshot() {
  const metrics = await computeExecutiveMetrics()
  const db = getFirestore()
  const id = `exec-${metrics.capturedAt.slice(0, 13)}`
  const doc = sanitizeFirestoreData({ id, ...metrics })
  await db.collection(METRICS_COLLECTION).doc(id).set(doc)
  return doc
}

async function getLatestExecutiveMetrics() {
  const computed = await computeExecutiveMetrics()
  try {
    const db = getFirestore()
    const snap = await db.collection(METRICS_COLLECTION).limit(20).get()
    const saved = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0))[0]
    return { live: computed, snapshot: saved || null }
  } catch {
    return { live: computed, snapshot: null }
  }
}

module.exports = {
  computeExecutiveMetrics,
  saveExecutiveMetricsSnapshot,
  getLatestExecutiveMetrics,
  METRICS_COLLECTION,
}
