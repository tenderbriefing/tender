const { getStorage } = require('./storageAdapter')
const auditLogService = require('./auditLogService')

const CHANNELS = ['email', 'whatsapp', 'push']

async function getAdminUserIds() {
  try {
    const { getFirestore } = require('../config/firebaseAdmin')
    const db = getFirestore()
    const snapshot = await db.collection('users').where('userType', '==', 'admin').get()
    return snapshot.docs.map((doc) => doc.id)
  } catch {
    return []
  }
}

function notificationCopy(eventType, data) {
  const tender = data.tenderNumber || data.tenderTitle || data.tenderId || 'Tender'
  switch (eventType) {
    case 'sme_saved_tender':
      return { title: 'Tender saved', message: `Saved ${tender} to your workspace.` }
    case 'sme_tracked_tender':
      return { title: 'Tender tracked', message: `Now tracking ${tender} in your workspace.` }
    case 'sme_requested_attendance':
      return {
        title: 'Attendance requested',
        message: `Your briefing attendance request for ${tender} is pending agent assignment.`,
      }
    case 'agent_accepted_briefing':
      return {
        title: 'Agent assigned',
        message: `${data.agentName || 'A Youth Agent'} accepted your briefing request for ${tender}.`,
      }
    case 'agent_declined_briefing':
      return {
        title: 'Agent declined',
        message: `An agent declined the briefing request for ${tender}. Other agents can still accept.`,
      }
    case 'briefing_report_submitted':
      return {
        title: 'Briefing report uploaded',
        message: `Briefing report submitted for ${tender}. Review it in My Requests.`,
      }
    case 'attendance_request_completed':
      return {
        title: 'Request completed',
        message: `Attendance workflow completed for ${tender}. Your briefing report is ready.`,
      }
    default:
      return { title: 'TenderBriefing update', message: eventType.replace(/_/g, ' ') }
  }
}

function resolveRecipients(eventType, data) {
  const recipients = new Set()

  switch (eventType) {
    case 'sme_saved_tender':
    case 'sme_tracked_tender':
      if (data.smeId) recipients.add(data.smeId)
      break
    case 'sme_requested_attendance':
      if (data.smeId) recipients.add(data.smeId)
      break
    case 'agent_accepted_briefing':
      if (data.smeId) recipients.add(data.smeId)
      if (data.assignedAgentId) recipients.add(data.assignedAgentId)
      if (data.agentId) recipients.add(data.agentId)
      break
    case 'agent_declined_briefing':
      if (data.smeId) recipients.add(data.smeId)
      if (data.declinedAgentId) recipients.add(data.declinedAgentId)
      break
    case 'briefing_report_submitted':
    case 'attendance_request_completed':
      if (data.smeId) recipients.add(data.smeId)
      if (data.assignedAgentId) recipients.add(data.assignedAgentId)
      if (data.agentId) recipients.add(data.agentId)
      break
    default:
      if (data.smeId) recipients.add(data.smeId)
      if (data.agentId) recipients.add(data.agentId)
      if (data.assignedAgentId) recipients.add(data.assignedAgentId)
  }

  return { recipients, notifyAdmins: !['sme_saved_tender', 'sme_tracked_tender'].includes(eventType) }
}

async function dispatch(channel, payload) {
  await auditLogService.logEvent({
    type: 'notification_queued',
    channel,
    status: 'queued',
    payload,
  })
  return { channel, status: 'queued', message: `${channel} delivery not yet configured` }
}

async function saveInboxNotifications(eventType, data) {
  const storage = getStorage()
  if (typeof storage.saveNotification !== 'function') return []

  const copy = notificationCopy(eventType, data)
  const { recipients, notifyAdmins } = resolveRecipients(eventType, data)
  const saved = []

  if (notifyAdmins) {
    const adminIds = await getAdminUserIds()
    for (const adminId of adminIds) recipients.add(adminId)
  }

  for (const userId of recipients) {
    if (!userId) continue
  const entry = await storage.saveNotification({
      eventType,
      userId,
      title: copy.title,
      message: copy.message,
      data: {
        requestId: data.id || data.requestId,
        tenderId: data.tenderId,
        tenderNumber: data.tenderNumber,
        reportId: data.reportId,
      },
      createdAt: new Date().toISOString(),
      read: false,
    })
    saved.push(entry)
  }

  return saved
}

async function notify(eventType, data) {
  const notifications = []

  switch (eventType) {
    case 'new_briefing_found':
      notifications.push(
        await dispatch('email', { template: 'new_briefing', data }),
        await dispatch('push', { template: 'new_briefing', data })
      )
      break
    case 'briefing_venue_changed':
    case 'briefing_date_changed':
      notifications.push(
        await dispatch('email', { template: eventType, data }),
        await dispatch('whatsapp', { template: eventType, data })
      )
      break
    case 'tender_closing_soon':
      notifications.push(await dispatch('email', { template: 'closing_soon', data }))
      break
    case 'agent_accepted_briefing':
    case 'agent_declined_briefing':
    case 'sme_requested_attendance':
    case 'sme_saved_tender':
    case 'sme_tracked_tender':
    case 'briefing_report_submitted':
    case 'attendance_request_completed':
      notifications.push(
        await dispatch('push', { template: eventType, data }),
        await dispatch('email', { template: eventType, data })
      )
      break
    default:
      notifications.push(await dispatch('email', { template: 'generic', data }))
  }

  try {
    await saveInboxNotifications(eventType, data)
  } catch {
    // non-blocking
  }

  await auditLogService.logEvent({
    type: 'notification',
    eventType,
    count: notifications.length,
    entityId: data?.tenderId || data?.requestId || data?.id,
  })

  return notifications
}

async function processTenderChangeNotifications(existing, updated) {
  if (!existing) {
    if (updated.briefingCompulsory) {
      await notify('new_briefing_found', { tenderId: updated.id, title: updated.title })
    }
    return
  }

  if (existing.briefingVenue !== updated.briefingVenue && updated.briefingVenue) {
    await notify('briefing_venue_changed', {
      tenderId: updated.id,
      from: existing.briefingVenue,
      to: updated.briefingVenue,
    })
  }

  if (existing.briefingDate !== updated.briefingDate && updated.briefingDate) {
    await notify('briefing_date_changed', {
      tenderId: updated.id,
      from: existing.briefingDate,
      to: updated.briefingDate,
    })
  }
}

module.exports = {
  CHANNELS,
  notify,
  dispatch,
  processTenderChangeNotifications,
}
