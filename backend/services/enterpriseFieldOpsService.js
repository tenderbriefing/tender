/**
 * Enterprise field operations — inspections, audits, verification (future-ready).
 */
const { persistInsight, nowIso } = require('./ai/_shared')
const liveDispatch = require('./liveDispatchService')
const fraudDetection = require('./trust/fraudDetectionService')

const OPS_TYPES = [
  'site_inspection',
  'supplier_verification',
  'field_audit',
  'compliance_inspection',
  'enterprise_dispatch',
  'municipal_inspection',
]

async function createFieldOp(patch) {
  const op = {
    id: patch.id || `efo-${Date.now()}`,
    type: patch.type || 'enterprise_dispatch',
    requestId: patch.requestId || null,
    tenderId: patch.tenderId || null,
    assignedAgentId: patch.assignedAgentId || null,
    smeId: patch.smeId || null,
    province: patch.province || null,
    status: 'scheduled',
    gpsRequired: true,
    fraudScanRequired: true,
    aiSummaryRequired: true,
    ...patch,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await persistInsight('enterpriseFieldOps', op.id, op)
  return op
}

async function dispatchEnterpriseFieldOp(op, attendanceRequest) {
  if (!attendanceRequest) return { op, dispatched: false }
  const dispatch = await liveDispatch.autoDispatchRequest(attendanceRequest, {
    radiusKm: op.radiusKm || 80,
    provinceWide: op.provinceWide === true,
    reason: `enterprise_${op.type}`,
  })
  if (op.assignedAgentId) {
    try {
      await fraudDetection.scanAgentActivity(op.assignedAgentId, { requestId: op.requestId })
    } catch {
      /* non-fatal */
    }
  }
  return { op, dispatched: true, dispatch }
}

module.exports = { createFieldOp, dispatchEnterpriseFieldOp, OPS_TYPES }
