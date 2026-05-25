#!/usr/bin/env node
/**
 * Phase 14 pilot system QA — no secrets logged.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const report = { checks: [], passed: false, blockers: [] }

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

async function main() {
  const pilotAnalytics = require('../backend/services/pilotAnalyticsService')
  const pilotCrm = require('../backend/services/pilotCrmService')
  const templates = require('../backend/services/pilotMessageTemplates')
  const { getFirestore } = require('../backend/config/firebaseAdmin')

  const dashboard = await pilotAnalytics.getPilotDashboard()
  check('pilot dashboard loads', Boolean(dashboard.targets))
  check('pilot targets present', dashboard.targets.smes === 10 && dashboard.targets.agents === 20)
  check('enhanced metrics', Boolean(dashboard.enhanced?.conversionFunnel))
  check('crm block', Boolean(dashboard.crm))

  const msg = templates.buildMessage('sme_invitation', {
    name: 'QA Lead',
    leadType: 'sme',
    province: 'Gauteng',
  })
  check('message template builds', msg.includes('TenderBriefing') && !msg.includes('{{'))
  check('no secret in template', !/TWILIO|service-account|\.env/i.test(msg))

  const lead = await pilotCrm.createLead(
    {
      name: `QA Pilot ${Date.now().toString().slice(-6)}`,
      company: 'QA Co',
      leadType: 'sme',
      province: 'Gauteng',
      whatsappNumber: '',
      email: 'qa-pilot@example.com',
      status: 'new',
    },
    'pilot-qa'
  )
  check('lead creation works', Boolean(lead.id))

  const outreach = await pilotCrm.sendLeadOutreach({
    leadId: lead.id,
    messageType: 'follow_up',
    sendWhatsApp: false,
    adminUid: 'pilot-qa',
  })
  check('outreach logging works', Boolean(outreach.outreach?.id))
  check('outreach copy mode', outreach.copied === true)

  const timeline = await pilotCrm.listOutreachForLead(lead.id)
  check('lead timeline', timeline.length >= 1)

  const feedback = await pilotCrm.submitFeedback({
    feedbackType: 'sme',
    userId: 'pilot-qa-user',
    rating: 5,
    comments: 'QA feedback',
    platformUsability: 4,
  })
  check('feedback submission', Boolean(feedback.id))

  const task = await pilotCrm.createTask(
    { taskType: 'follow_up_lead', leadId: lead.id },
    'pilot-qa'
  )
  check('pilot task creation', Boolean(task.id))

  const db = getFirestore()
  for (const col of ['pilotLeads', 'pilotOutreach', 'pilotTasks', 'pilotFeedback']) {
    try {
      await db.collection(col).limit(1).get()
      check(`Firestore ${col} readable`, true)
    } catch (e) {
      check(`Firestore ${col} readable`, false, e.message)
    }
  }

  await pilotCrm.updateLead(lead.id, { status: 'rejected' }, 'pilot-qa')

  report.passed = report.blockers.length === 0
  report.operationalReadiness = report.passed ? 'ready' : 'blocked'
  report.summary = {
    leads: dashboard.crm?.leadsByStatus,
    outreachSent: dashboard.crm?.outreachSent,
    feedbackAvg: dashboard.crm?.feedbackAvgRating,
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
