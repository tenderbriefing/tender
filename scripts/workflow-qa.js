#!/usr/bin/env node
/**
 * Workflow automation QA — no secrets logged.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const workflow = require('../backend/services/workflowAutomationService')
const { getStorage } = require('../backend/services/storageAdapter')

const report = {
  checks: [],
  passed: false,
  blockers: [],
}

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

async function main() {
  const storage = getStorage()

  check('dispatchWorkflowEvent exists', typeof workflow.dispatchWorkflowEvent === 'function')
  check(
    'supported events include attendance_requested',
    workflow.SUPPORTED_EVENTS.has('attendance_requested')
  )

  const testPayload = {
    id: 'qa-wf-test',
    requestId: 'qa-wf-test',
    smeId: 'qa-sme',
    tenderId: 'qa-tender',
    tenderNumber: 'QA-001',
    province: 'Gauteng',
    notifiedAgents: [],
    paymentStatus: 'paid',
  }

  try {
    const dup = await workflow.dispatchWorkflowEvent('attendance_requested', testPayload, {
      force: true,
    })
    check('workflow dispatch runs', dup.success === true || dup.duplicate === true)
    check(
      'workflowEvents log created',
      !!dup.workflowEvent?.id || !!dup.workflowEvent?.type
    )
  } catch (e) {
    check('workflow dispatch runs', false, e.message)
  }

  try {
    const telemetry = await workflow.getWorkflowTelemetry({ limit: 5 })
    check('workflow telemetry', telemetry.total >= 0)
    report.telemetry = { total: telemetry.total, byStatus: telemetry.byStatus }
  } catch (e) {
    check('workflow telemetry', false, e.message)
  }

  const requests = await storage.getAttendanceRequests()
  const paidPending = requests.filter(
    (r) => r.paymentStatus === 'paid' && r.status === 'pending'
  )
  report.sampleRequests = {
    total: requests.length,
    paidPending: paidPending.length,
  }

  try {
    const sla = await workflow.runSlaEscalations()
    check('SLA job runs', typeof sla.agentEscalations === 'number')
    report.sla = sla
  } catch (e) {
    check('SLA job runs', false, e.message)
  }

  try {
    const retryPolicy = require('../backend/services/whatsappRetryPolicy')
    check(
      'QA dup2 blocked from retry',
      !retryPolicy.isWhatsAppRetryAllowed({
        type: 'qa_dup',
        message: 'dup2',
        to: '+27720708467',
        status: 'failed',
      })
    )
    check(
      'admin_test blocked from retry',
      !retryPolicy.isWhatsAppRetryAllowed({
        type: 'admin_test',
        message: 'short',
        status: 'pending',
        metadata: { source: 'test-whatsapp-api' },
      })
    )
    check(
      'operational reminder allowed',
      retryPolicy.isWhatsAppRetryAllowed({
        type: 'agent_briefing_reminder',
        message: 'Reminder: compulsory briefing tomorrow at 09:00.',
        to: '+27821234567',
        status: 'failed',
      })
    )

    const retry = await workflow.retryFailedWhatsApp({ limit: 3 })
    check('WhatsApp retry job runs', typeof retry.retried === 'number')
    check('WhatsApp retry returns skipped count', typeof retry.skipped === 'number')
    report.whatsappRetry = retry
  } catch (e) {
    check('WhatsApp retry job runs', false, e.message)
  }

  report.passed = report.blockers.length === 0
  report.operationalReadiness = report.passed ? 'ready' : 'not_ready'
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.log(JSON.stringify({ passed: false, error: e.message }))
  process.exit(1)
})
