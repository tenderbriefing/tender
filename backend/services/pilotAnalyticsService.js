/**
 * Pilot analytics — CRM funnel, operations, and launch targets.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const pilotLaunch = require('./pilotLaunchService')
const pilotCrm = require('./pilotCrmService')
const { getStorage } = require('./storageAdapter')
const whatsappService = require('./whatsappService')

async function collectionCount(query) {
  try {
    const snap = await query.count().get()
    return snap.data().count || 0
  } catch {
    const snap = await query.limit(5000).get()
    return snap.size
  }
}

async function getPilotDashboard() {
  const db = getFirestore()
  const base = await pilotLaunch.getPilotLaunchMetrics()
  const storage = getStorage()

  const [
    leads,
    outreachSnap,
    tasks,
    feedback,
    requests,
    slaSnap,
    verifiedAgentsQuery,
    onboardedSmes,
    onboardedAgents,
  ] = await Promise.all([
    pilotCrm.listLeads({}),
    db.collection(pilotCrm.COL.outreach).limit(500).get(),
    pilotCrm.listTasks({}),
    pilotCrm.listFeedback(200),
    storage.getAttendanceRequests(),
    db.collection('slaBreaches').orderBy('createdAt', 'desc').limit(100).get().catch(() => ({ docs: [] })),
    db.collection('agents').where('verificationStatus', '==', 'verified'),
    pilotLaunch.countOnboarded(db, 'smes'),
    pilotLaunch.countOnboarded(db, 'agents'),
  ])

  const outreach = outreachSnap.docs.map((d) => d.data())
  const outreachSent = outreach.filter((o) => o.status === 'sent').length
  const outreachCopied = outreach.filter((o) => o.status === 'copied').length
  const outreachFailed = outreach.filter((o) => o.status === 'failed' || o.status === 'skipped').length

  const leadsByStatus = {}
  for (const l of leads) {
    const s = l.status || 'new'
    leadsByStatus[s] = (leadsByStatus[s] || 0) + 1
  }

  const smeLeads = leads.filter((l) => l.leadType === 'sme').length
  const agentLeads = leads.filter((l) => l.leadType === 'agent').length
  const onboardedLeads = leads.filter((l) => l.status === 'onboarded').length
  const leadConversionPct =
    leads.length > 0 ? Math.round((onboardedLeads / leads.length) * 1000) / 10 : null

  const totalSmes = base.progress.smes.current
  const totalAgents = base.progress.agents.current
  const onboardingPctSme =
    totalSmes > 0 ? Math.round((onboardedSmes / totalSmes) * 1000) / 10 : null
  const onboardingPctAgent =
    totalAgents > 0 ? Math.round((onboardedAgents / totalAgents) * 1000) / 10 : null

  const verifiedAgents = await collectionCount(verifiedAgentsQuery)

  const ratings = feedback.filter((f) => f.rating >= 1 && f.rating <= 5)
  const feedbackAvg =
    ratings.length > 0
      ? Math.round((ratings.reduce((s, f) => s + f.rating, 0) / ratings.length) * 10) / 10
      : null

  const paid = requests.filter((r) => r.paymentStatus === 'paid')
  const completed = requests.filter((r) => r.status === 'completed')
  const funnel = {
    leadsTotal: leads.length,
    leadsContacted: (leadsByStatus.contacted || 0) + (leadsByStatus.interested || 0) + onboardedLeads,
    leadsInterested: leadsByStatus.interested || 0,
    leadsOnboarded: onboardedLeads,
    registeredSmes: totalSmes,
    registeredAgents: totalAgents,
    requestsTotal: requests.length,
    requestsPaid: paid.length,
    requestsCompleted: completed.length,
    paymentConversionPct:
      requests.length > 0 ? Math.round((paid.length / requests.length) * 1000) / 10 : null,
  }

  const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length
  const waStats = await whatsappService.getWhatsAppStats(50)
  const pilotOutreachSent = outreachSent
  const pilotOutreachTotal = outreach.length
  const responseRate =
    pilotOutreachTotal > 0
      ? Math.round(((leadsByStatus.interested || 0) + onboardedLeads) / pilotOutreachTotal * 1000) / 10
      : null

  return {
    ...base,
    crm: {
      leadsByStatus,
      smeLeads,
      agentLeads,
      leadConversionPct,
      outreachSent,
      outreachCopied,
      outreachFailed,
      outreachTotal: pilotOutreachTotal,
      responseRate,
      openTasks,
      feedbackCount: feedback.length,
      feedbackAvgRating: feedbackAvg,
    },
    enhanced: {
      onboardedSmes,
      onboardedAgents,
      onboardingPctSme,
      onboardingPctAgent,
      verifiedAgents,
      completedBriefings: base.operations.completedReports,
      slaBreachCount: slaSnap.docs?.length ?? 0,
      conversionFunnel: funnel,
      whatsappDeliverySuccess: base.operations.whatsapp.healthPct,
    },
  }
}

module.exports = {
  getPilotDashboard,
}
