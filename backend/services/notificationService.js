const { getStorage } = require('./storageAdapter')
const auditLogService = require('./auditLogService')

const CHANNELS = ['email', 'whatsapp', 'push']

async function dispatch(channel, payload) {
  // Future-ready: wire to Gmail, WhatsApp Business API, FCM
  await auditLogService.logEvent({
    type: 'notification_queued',
    channel,
    status: 'queued',
    payload,
  })
  return { channel, status: 'queued', message: `${channel} delivery not yet configured` }
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
    case 'sme_requested_attendance':
    case 'briefing_report_submitted':
      notifications.push(
        await dispatch('push', { template: eventType, data }),
        await dispatch('email', { template: eventType, data })
      )
      break
    default:
      notifications.push(await dispatch('email', { template: 'generic', data }))
  }

  try {
    const storage = getStorage()
    if (typeof storage.saveNotification === 'function') {
      await storage.saveNotification({
        eventType,
        data,
        userId: data.smeId || data.agentId || data.assignedAgentId || null,
        createdAt: new Date().toISOString(),
        read: false,
      })
    }
  } catch {
    // non-blocking
  }

  await auditLogService.logEvent({
    type: 'notification',
    eventType,
    count: notifications.length,
    entityId: data?.tenderId || data?.requestId,
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
