/**
 * Phase 13 — Fulfilment completion + controlled reopen for correction.
 */
const auditLogService = require('../auditLogService')
const opsLifecycle = require('./opsLifecycleService')
const reports = require('./reportProductionService')
const { isCompletionEligible } = require('../../domain/opsSlaEngine')
const { deriveManualOpsStage } = require('../../domain/manualBriefingOps')

async function completeFulfilment(requestId, adminUser = {}, opts = {}) {
  const request = await opsLifecycle.getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')

  const stage = deriveManualOpsStage(request)
  if (stage === 'completed') {
    return { request, alreadyCompleted: true }
  }

  const eligibility = isCompletionEligible(request, opts)
  if (!eligibility.eligible) {
    throw new Error(`Cannot complete fulfilment: ${eligibility.reasons.join(', ')}`)
  }

  if (stage !== 'delivered' && !request.deliveredAt) {
    throw new Error('Request must be Delivered before marking Completed')
  }

  const now = new Date().toISOString()
  request.completedAt = now
  request.completedBy = adminUser.uid || null
  request.completedByEmail = adminUser.email || null
  request.finalReportVersionId = request.opsReportId || null
  request.finalDeliveryId = request.clientDeliveryId || null
  request.fulfilmentStatus = 'completed'
  request.opsStage = 'completed'
  const saved = await opsLifecycle.saveRequest(request)

  await auditLogService.logEvent({
    type: 'ops_fulfilment_completed',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    finalReportVersionId: saved.finalReportVersionId,
    deliveryId: saved.finalDeliveryId,
  })

  return { request: saved, alreadyCompleted: false }
}

/**
 * REOPEN FOR CORRECTION — previous delivered versions remain immutable.
 * Creates a new report draft version for edits → approve → delivery.
 */
async function reopenForCorrection(requestId, input = {}, adminUser = {}) {
  const reason = String(input.reason || input.reopenReason || '').trim()
  if (!reason || reason.length < 8) {
    throw new Error('Mandatory reopen reason required (min 8 characters)')
  }
  if (input.confirm !== true) {
    throw new Error('Explicit confirm=true is required to reopen for correction')
  }

  const request = await opsLifecycle.getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  const stage = deriveManualOpsStage(request)
  if (stage !== 'completed' && stage !== 'delivered' && stage !== 'closed') {
    throw new Error(`Cannot reopen from stage: ${stage}`)
  }

  const priorReportId = request.opsReportId || request.finalReportVersionId || null
  const now = new Date().toISOString()

  // Preserve completion/delivery snapshot; clear stamps so correction can progress
  request.previousCompletion = {
    completedAt: request.completedAt || null,
    completedBy: request.completedBy || null,
    finalReportVersionId: request.finalReportVersionId || priorReportId,
    finalDeliveryId: request.finalDeliveryId || request.clientDeliveryId || null,
    deliveredAt: request.deliveredAt || null,
    reportReadyAt: request.reportReadyAt || null,
    opsReportId: priorReportId,
  }
  request.reopenedAt = now
  request.reopenedBy = adminUser.uid || null
  request.reopenedByEmail = adminUser.email || null
  request.reopenReason = reason.slice(0, 500)
  request.completedAt = null
  request.completedBy = null
  request.finalReportVersionId = null
  request.finalDeliveryId = null
  request.fulfilmentStatus = 'reopened'
  request.closedAt = null
  request.deliveredAt = null
  request.reportDeliveredAt = null
  request.reportReadyAt = null
  request.reportStatus = 'in_progress'
  request.reportStage = 'in_progress'
  request.clientDeliveryStatus = null
  request.clientDeliveryId = null
  request.opsStage = 'report_in_progress'
  await opsLifecycle.saveRequest(request)

  await auditLogService.logEvent({
    type: 'ops_fulfilment_reopened',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    reopenReason: reason.slice(0, 240),
    priorReportVersionId: priorReportId,
  })

  // New draft version — does not overwrite approved history
  const generated = await reports.generateDraft(requestId, adminUser)
  await auditLogService.logEvent({
    type: 'ops_correction_report_draft_created',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    reportId: generated.report.id,
    version: generated.report.version,
    priorReportVersionId: priorReportId,
  })

  return {
    request: generated.request,
    report: generated.report,
    priorReportVersionId: priorReportId,
  }
}

module.exports = {
  completeFulfilment,
  reopenForCorrection,
  isCompletionEligible,
}
