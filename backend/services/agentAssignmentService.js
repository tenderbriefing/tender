const { getStorage } = require('./storageAdapter')
const auditLogService = require('./auditLogService')
const notificationService = require('./notificationService')

const DEFAULT_RADIUS_KM = 50

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeStatus(status) {
  if (status === 'accepted') return 'assigned'
  return status
}

function createAttendanceRequest(payload) {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenderId: payload.tenderId,
    tenderNumber: payload.tenderNumber || '',
    tenderTitle: payload.tenderTitle || '',
    smeId: payload.smeId,
    smeName: payload.smeName || '',
    smeCompany: payload.smeCompany || '',
    smeEmail: payload.smeEmail || '',
    smePhone: payload.smePhone || '',
    province: payload.province || '',
    department: payload.department || '',
    briefingVenue: payload.briefingVenue || '',
    briefingDate: payload.briefingDate || '',
    briefingTime: payload.briefingTime || '',
    status: 'pending',
    agentId: null,
    assignedAgentId: null,
    agentName: null,
    acceptedAt: null,
    paymentStatus: payload.paymentStatus || 'not_required',
    quotedFee: payload.quotedFee ?? null,
    currency: payload.currency || 'ZAR',
    paymentProvider: payload.paymentProvider || 'none',
    agentReliabilityScore: null,
    radiusKm: payload.radiusKm || DEFAULT_RADIUS_KM,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: payload.notes || '',
    responsibilityAcknowledged: payload.responsibilityAcknowledged === true,
    notifiedAgents: [],
    declines: [],
  }
}

const ACTIVE_REQUEST_STATUSES = new Set(['pending', 'assigned', 'accepted'])

async function findActiveRequestForSmeTender(smeId, tenderId) {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests({ smeId })
  return requests.find(
    (r) =>
      r.tenderId === tenderId &&
      ACTIVE_REQUEST_STATUSES.has(normalizeStatus(r.status))
  )
}

function scoreAgent(agent, request) {
  let score = agent.rating || 3
  if (agent.verified) score += 1
  if (agent.province && request.province && agent.province === request.province) {
    score += 2
  }
  if ((agent.missedMeetings || 0) >= 2) score -= 5
  if (agent.availability === 'available') score += 2
  return score
}

function findNearbyAgents(agents, request) {
  return agents
    .filter((a) => a.userType === 'youth-agent' || a.userType === 'connector')
    .filter((a) => (a.missedMeetings || 0) < 2)
    .filter((a) => {
      if (!a.latitude || !a.longitude || !request.latitude || !request.longitude) {
        return a.province === request.province || !request.province
      }
      return (
        haversineKm(
          a.latitude,
          a.longitude,
          request.latitude,
          request.longitude
        ) <= (request.radiusKm || DEFAULT_RADIUS_KM)
      )
    })
    .map((a) => ({ ...a, matchScore: scoreAgent(a, request) }))
    .sort((a, b) => b.matchScore - a.matchScore)
}

async function getRequestById(requestId) {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const request = requests.find((r) => r.id === requestId)
  if (!request) return null
  return { ...request, status: normalizeStatus(request.status) }
}

async function createRequest(payload, agents = []) {
  const storage = getStorage()
  const existing = await findActiveRequestForSmeTender(payload.smeId, payload.tenderId)
  if (existing) {
    throw new Error(
      `An active attendance request already exists for this tender (${existing.id})`
    )
  }

  const request = createAttendanceRequest(payload)

  const nearby = findNearbyAgents(agents, request)
  request.notifiedAgents = nearby.slice(0, 10).map((a) => a.id)

  await storage.saveAttendanceRequest(request)
  await notificationService.notify('sme_requested_attendance', request)
  await auditLogService.logEvent({
    type: 'sme_request',
    entityId: request.id,
    tenderId: request.tenderId,
    smeId: request.smeId,
  })

  return { request, nearbyAgents: nearby }
}

async function assignRequestToAgent(requestId, agent, { byAdmin = false } = {}) {
  const storage = getStorage()
  const request = await getRequestById(requestId)

  if (!request) throw new Error('Attendance request not found')
  if (request.status !== 'pending') {
    throw new Error(`Request already ${request.status}`)
  }

  const now = new Date().toISOString()
  request.status = 'assigned'
  request.agentId = agent.id
  request.assignedAgentId = agent.id
  request.agentName = agent.displayName || agent.name || ''
  request.agentReliabilityScore = agent.rating || null
  request.acceptedAt = now
  request.updatedAt = now
  if (byAdmin) request.assignedByAdmin = true

  await storage.saveAttendanceRequest(request)
  await notificationService.notify('agent_accepted_briefing', request)
  await auditLogService.logEvent({
    type: byAdmin ? 'admin_assign_agent' : 'agent_acceptance',
    entityId: request.id,
    agentId: agent.id,
  })

  return request
}

async function acceptRequest(requestId, agent) {
  return assignRequestToAgent(requestId, agent, { byAdmin: false })
}

async function declineRequest(requestId, agentId, reason = '') {
  const storage = getStorage()
  const request = await getRequestById(requestId)
  if (!request) throw new Error('Attendance request not found')
  if (request.status !== 'pending') {
    throw new Error('Only pending requests can be declined')
  }

  request.declines = request.declines || []
  const already = request.declines.some((d) => d.agentId === agentId)
  if (!already) {
    request.declines.push({ agentId, reason, at: new Date().toISOString() })
  }
  request.updatedAt = new Date().toISOString()

  await storage.saveAttendanceRequest(request)
  await notificationService.notify('agent_declined_briefing', {
    ...request,
    declinedAgentId: agentId,
    declineReason: reason,
  })
  await auditLogService.logEvent({
    type: 'agent_decline',
    entityId: request.id,
    agentId,
    reason,
  })

  return request
}

async function listOpportunitiesForAgent(agentId, agentProvince = '') {
  const storage = getStorage()
  const all = await storage.getAttendanceRequests()
  return all
    .map((r) => ({ ...r, status: normalizeStatus(r.status) }))
    .filter((r) => {
      if (r.status === 'pending') {
        if (r.notifiedAgents?.includes(agentId)) return true
        if (agentProvince && r.province && r.province === agentProvince) return true
        return true
      }
      if (r.status === 'assigned' && r.assignedAgentId === agentId) return true
      return false
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

async function submitBriefingReport(payload) {
  const storage = getStorage()
  const report = {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requestId: payload.requestId,
    agentId: payload.agentId,
    tenderId: payload.tenderId,
    summary: payload.summary || '',
    audioUrl: payload.audioUrl || '',
    attendanceProofUrl: payload.attendanceProofUrl || '',
    documentUrls: payload.documentUrls || [],
    photoUrls: payload.photoUrls || [],
    notes: payload.notes || '',
    attendanceConfirmed: payload.attendanceConfirmed === true,
    arrivalTime: payload.arrivalTime || '',
    briefingStartedTime: payload.briefingStartedTime || '',
    keyInstructions: payload.keyInstructions || '',
    submissionRequirements: payload.submissionRequirements || '',
    documentsCollected: payload.documentsCollected || '',
    questionsAsked: payload.questionsAsked || '',
    risksClarifications: payload.risksClarifications || '',
    status: 'submitted',
    createdAt: new Date().toISOString(),
  }

  await storage.saveBriefingReport(report)

  const request = await getRequestById(payload.requestId)
  if (request) {
    request.status = 'completed'
    request.reportId = report.id
    request.updatedAt = new Date().toISOString()
    await storage.saveAttendanceRequest(request)
    await notificationService.notify('attendance_request_completed', {
      ...request,
      reportId: report.id,
    })
    await notificationService.notify('briefing_report_submitted', {
      ...request,
      reportId: report.id,
    })
  }

  await auditLogService.logEvent({
    type: 'briefing_report',
    entityId: report.id,
    requestId: payload.requestId,
    agentId: payload.agentId,
  })

  return report
}

module.exports = {
  DEFAULT_RADIUS_KM,
  haversineKm,
  findNearbyAgents,
  getRequestById,
  findActiveRequestForSmeTender,
  createRequest,
  acceptRequest,
  assignRequestToAgent,
  declineRequest,
  listOpportunitiesForAgent,
  submitBriefingReport,
}
