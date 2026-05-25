const { getStorage } = require('./storageAdapter')
const auditLogService = require('./auditLogService')
const whatsappService = require('./whatsappService')

const CHANNELS = ['email', 'whatsapp', 'push']

const WHATSAPP_TEMPLATES = {
  sme_attendance_submitted:
    'Your TenderBriefing request for {{tenderNumber}} has been submitted successfully.',
  sme_agent_assigned:
    'A Youth Agent has been assigned to your TenderBriefing request for {{tenderNumber}}.',
  sme_report_uploaded:
    'A briefing report for {{tenderNumber}} is now available on TenderBriefing.',
  sme_closing_reminder:
    'Reminder: tender {{tenderNumber}} is closing soon. Review details on TenderBriefing.',
  agent_new_opportunity:
    'You have a new TenderBriefing opportunity near {{province}}.',
  agent_request_accepted:
    'You have accepted a TenderBriefing briefing assignment for {{tenderNumber}}.',
  agent_briefing_reminder:
    'Reminder: Tender briefing starts in 2 hours ({{tenderNumber}}).',
  agent_payment_confirmed:
    'Payment confirmed — a paid TenderBriefing request is now available near {{province}}.',
  agent_briefing_missed:
    'TenderBriefing: you were marked absent for briefing {{tenderNumber}}. Contact support if incorrect.',
  admin_briefing_missed:
    'TenderBriefing: agent missed briefing for {{tenderNumber}} (request {{requestId}}).',
  sme_report_with_pdf:
    'Briefing report for {{tenderNumber}} is ready. Download: {{pdfUrl}}',
  admin_payment_failed:
    'TenderBriefing: payment failed for request {{requestId}} ({{tenderNumber}}).',
  admin_report_uploaded:
    'TenderBriefing: briefing report uploaded for {{tenderNumber}}.',
  admin_request_spike:
    'TenderBriefing: high volume of new attendance requests in the last hour.',
}

function renderTemplate(key, vars = {}) {
  let text = WHATSAPP_TEMPLATES[key] || WHATSAPP_TEMPLATES.sme_attendance_submitted
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''))
  }
  return text
}

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

async function resolveUserPhone(userId) {
  if (!userId) return null
  try {
    const { getFirestore } = require('../config/firebaseAdmin')
    const db = getFirestore()
    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists) {
      const u = userDoc.data()
      const phone = u.phoneNumber || u.phone || u.whatsappNumber
      if (phone) return phone
    }
    const smeDoc = await db.collection('smes').doc(userId).get()
    if (smeDoc.exists) {
      const s = smeDoc.data()
      return s.phoneNumber || s.phone || s.contactPhone || null
    }
    const agentDoc = await db.collection('agents').doc(userId).get()
    if (agentDoc.exists) {
      const a = agentDoc.data()
      return a.phoneNumber || a.phone || null
    }
  } catch {
    return null
  }
  return null
}

function userRoleFromEvent(eventType, userId, data) {
  if (data.smeId === userId) return 'sme'
  if (data.assignedAgentId === userId || data.agentId === userId) return 'youth-agent'
  if (data.declinedAgentId === userId) return 'youth-agent'
  if (Array.isArray(data.notifiedAgents) && data.notifiedAgents.includes(userId)) {
    return 'youth-agent'
  }
  return 'admin'
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
    case 'payment_confirmed':
      return {
        title: 'Payment received',
        message: `Your attendance support fee for ${tender} was received. Youth Agents can now view your request.`,
      }
    case 'payment_failed':
      return {
        title: 'Payment failed',
        message: `Payment for ${tender} was not completed. You can retry payment from My Requests.`,
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
      if (Array.isArray(data.notifiedAgents)) {
        for (const agentId of data.notifiedAgents) {
          if (agentId) recipients.add(agentId)
        }
      }
      break
    case 'payment_confirmed':
      if (data.smeId) recipients.add(data.smeId)
      if (Array.isArray(data.notifiedAgents)) {
        for (const agentId of data.notifiedAgents) {
          if (agentId) recipients.add(agentId)
        }
      }
      break
    case 'payment_failed':
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
    case 'briefing_missed':
      if (data.smeId) recipients.add(data.smeId)
      if (data.assignedAgentId) recipients.add(data.assignedAgentId)
      break
    case 'tender_closing_soon':
      if (data.smeId) recipients.add(data.smeId)
      break
    default:
      if (data.smeId) recipients.add(data.smeId)
      if (data.agentId) recipients.add(data.agentId)
      if (data.assignedAgentId) recipients.add(data.assignedAgentId)
  }
  return { recipients, notifyAdmins: !['sme_saved_tender', 'sme_tracked_tender'].includes(eventType) }
}

async function dispatch(channel, payload) {
  if (channel === 'whatsapp') {
    return { channel, status: 'delegated', message: 'WhatsApp handled by queueWhatsAppNotification' }
  }
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
      channel: 'inbox',
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

/**
 * Queue and send WhatsApp for one recipient.
 */
async function queueWhatsAppNotification({
  type,
  recipientRole,
  recipientId,
  phone,
  message,
  metadata = {},
  idempotencyKey,
}) {
  const to = phone || (await resolveUserPhone(recipientId))
  if (!to) {
    await whatsappService.saveDeliveryLog({
      type,
      recipientRole,
      recipientId,
      message,
      status: 'skipped',
      error: 'No phone number on file',
      metadata,
      idempotencyKey,
    })
    return { ok: false, skipped: true, reason: 'no_phone' }
  }

  return whatsappService.sendWhatsAppMessage(to, message, {
    type,
    recipientRole,
    recipientId,
    metadata,
    idempotencyKey,
  })
}

async function sendWhatsAppNotification(payload) {
  return queueWhatsAppNotification(payload)
}

async function countRecentAttendanceRequests(withinMs = 60 * 60 * 1000) {
  try {
    const storage = getStorage()
    const all = await storage.getAttendanceRequests()
    const since = Date.now() - withinMs
    return all.filter((r) => new Date(r.createdAt || 0).getTime() >= since).length
  } catch {
    return 0
  }
}

async function processWhatsAppForEvent(eventType, data) {
  const results = []
  const tenderNumber = data.tenderNumber || data.tenderTitle || 'tender'
  const province = data.province || 'your province'
  const requestId = data.id || data.requestId || ''

  const enqueue = async (opts) => {
    const r = await queueWhatsAppNotification(opts)
    results.push(r)
  }

  switch (eventType) {
    case 'payment_confirmed':
    case 'sme_requested_attendance':
      if (Array.isArray(data.notifiedAgents)) {
        for (const agentId of data.notifiedAgents) {
          await enqueue({
            type: 'agent_new_opportunity',
            recipientRole: 'youth-agent',
            recipientId: agentId,
            message: renderTemplate('agent_new_opportunity', { province }),
            metadata: { eventType, requestId },
            idempotencyKey: `agent_opp:${agentId}:${requestId}:${eventType}`,
          })
          if (eventType === 'payment_confirmed') {
            await enqueue({
              type: 'agent_payment_confirmed',
              recipientRole: 'youth-agent',
              recipientId: agentId,
              message: renderTemplate('agent_payment_confirmed', { province }),
              metadata: { eventType, requestId },
              idempotencyKey: `agent_paid_opp:${agentId}:${requestId}`,
            })
          }
        }
      }
      if (eventType === 'sme_requested_attendance' && data.smeId) {
        await enqueue({
          type: 'sme_attendance_submitted',
          recipientRole: 'sme',
          recipientId: data.smeId,
          message: renderTemplate('sme_attendance_submitted', { tenderNumber }),
          metadata: { eventType, requestId, tenderId: data.tenderId },
          idempotencyKey: `sme_submitted:${data.smeId}:${requestId}`,
        })
      }
      break

    case 'agent_accepted_briefing':
      if (data.smeId) {
        await enqueue({
          type: 'sme_agent_assigned',
          recipientRole: 'sme',
          recipientId: data.smeId,
          message: renderTemplate('sme_agent_assigned', { tenderNumber }),
          metadata: { eventType, requestId },
          idempotencyKey: `sme_assigned:${data.smeId}:${requestId}`,
        })
      }
      if (data.assignedAgentId) {
        await enqueue({
          type: 'agent_request_accepted',
          recipientRole: 'youth-agent',
          recipientId: data.assignedAgentId,
          message: renderTemplate('agent_request_accepted', { tenderNumber }),
          metadata: { eventType, requestId },
          idempotencyKey: `agent_accepted:${data.assignedAgentId}:${requestId}`,
        })
      }
      break

    case 'briefing_report_submitted':
      if (data.smeId) {
        const reportMsg = data.pdfSummaryUrl
          ? renderTemplate('sme_report_with_pdf', {
              tenderNumber,
              pdfUrl: data.pdfSummaryUrl,
            })
          : renderTemplate('sme_report_uploaded', { tenderNumber })
        await enqueue({
          type: 'sme_report_uploaded',
          recipientRole: 'sme',
          recipientId: data.smeId,
          message: reportMsg,
          metadata: { eventType, requestId, reportId: data.reportId, pdfSummaryUrl: data.pdfSummaryUrl },
          idempotencyKey: `sme_report:${data.smeId}:${requestId}`,
        })
      }
      for (const adminId of await getAdminUserIds()) {
        await enqueue({
          type: 'admin_report_uploaded',
          recipientRole: 'admin',
          recipientId: adminId,
          message: renderTemplate('admin_report_uploaded', { tenderNumber }),
          metadata: { eventType, requestId },
          idempotencyKey: `admin_report:${adminId}:${requestId}`,
        })
      }
      break

    case 'payment_failed':
      for (const adminId of await getAdminUserIds()) {
        await enqueue({
          type: 'admin_payment_failed',
          recipientRole: 'admin',
          recipientId: adminId,
          message: renderTemplate('admin_payment_failed', { requestId, tenderNumber }),
          metadata: { eventType, requestId },
          idempotencyKey: `admin_pay_fail:${adminId}:${requestId}`,
        })
      }
      break

    case 'tender_closing_soon':
      if (data.smeId) {
        await enqueue({
          type: 'sme_closing_reminder',
          recipientRole: 'sme',
          recipientId: data.smeId,
          message: renderTemplate('sme_closing_reminder', { tenderNumber }),
          metadata: { eventType, tenderId: data.tenderId },
          idempotencyKey: `sme_close:${data.smeId}:${data.tenderId}`,
        })
      }
      break

    case 'briefing_date_changed':
    case 'briefing_venue_changed': {
      const targets = new Set()
      if (data.smeId) targets.add(data.smeId)
      if (data.assignedAgentId) targets.add(data.assignedAgentId)
      if (data.agentId) targets.add(data.agentId)
      for (const uid of targets) {
        const role = userRoleFromEvent(eventType, uid, data)
        await enqueue({
          type: 'agent_briefing_reminder',
          recipientRole: role,
          recipientId: uid,
          message: renderTemplate('agent_briefing_reminder', { tenderNumber }),
          metadata: { eventType, tenderId: data.tenderId },
          idempotencyKey: `briefing_remind:${uid}:${data.tenderId}:${data.to || ''}`,
        })
      }
      break
    }

    default:
      break
  }

  if (eventType === 'sme_requested_attendance') {
    const recent = await countRecentAttendanceRequests(60 * 60 * 1000)
    if (recent >= 5) {
      for (const adminId of await getAdminUserIds()) {
        await enqueue({
          type: 'admin_request_spike',
          recipientRole: 'admin',
          recipientId: adminId,
          message: renderTemplate('admin_request_spike', {}),
          metadata: { eventType, recentCount: recent },
          idempotencyKey: `admin_spike:${adminId}:${new Date().toISOString().slice(0, 13)}`,
        })
      }
    }
  }

  return results
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
      notifications.push(
        await dispatch('email', { template: 'closing_soon', data }),
        await dispatch('whatsapp', { template: eventType, data })
      )
      break
    case 'briefing_missed':
    case 'agent_accepted_briefing':
    case 'agent_declined_briefing':
    case 'sme_requested_attendance':
    case 'sme_saved_tender':
    case 'sme_tracked_tender':
    case 'briefing_report_submitted':
    case 'attendance_request_completed':
    case 'briefing_missed':
    case 'payment_confirmed':
    case 'payment_failed':
      notifications.push(
        await dispatch('push', { template: eventType, data }),
        await dispatch('email', { template: eventType, data }),
        await dispatch('whatsapp', { template: eventType, data })
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

  try {
    const waResults = await processWhatsAppForEvent(eventType, data)
    notifications.push(...waResults.map((r) => ({ channel: 'whatsapp', ...r })))
  } catch (err) {
    console.error(
      '[notificationService] WhatsApp processing error:',
      err instanceof Error ? err.message : err
    )
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
      tenderNumber: updated.tenderNumber,
      from: existing.briefingVenue,
      to: updated.briefingVenue,
    })
  }
  if (existing.briefingDate !== updated.briefingDate && updated.briefingDate) {
    await notify('briefing_date_changed', {
      tenderId: updated.id,
      tenderNumber: updated.tenderNumber,
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
  queueWhatsAppNotification,
  sendWhatsAppNotification,
  processWhatsAppForEvent,
  renderTemplate,
  resolveUserPhone,
  notificationCopy,
}
