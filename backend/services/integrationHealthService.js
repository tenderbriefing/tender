const metaWhatsapp = require('./integrations/whatsappService')
const twilioWhatsapp = require('./whatsappService')
const firebaseStorage = require('./integrations/firebaseStorageService')
const maps = require('./integrations/mapsService')
const fcm = require('./integrations/fcmService')
const yoco = require('./integrations/yocoService')
const openai = require('./integrations/openaiService')
const analytics = require('./integrations/analyticsService')
const googleCalendar = require('./integrations/calendarService')
const microsoftGraph = require('./integrations/microsoftGraphService')

async function safeHealth(fn) {
  try {
    return await fn()
  } catch (error) {
    return {
      status: 'error',
      message: error.message || 'Health check failed',
      lastChecked: new Date().toISOString(),
    }
  }
}

async function getIntegrationsHealth() {
  const checkedAt = new Date().toISOString()
  const analyticsHealth = await safeHealth(() => analytics.healthCheck())

  const integrations = [
    await safeHealth(() => twilioWhatsapp.healthCheck()),
    await safeHealth(() => metaWhatsapp.healthCheck()),
    await safeHealth(() => firebaseStorage.healthCheck()),
    await safeHealth(() => maps.healthCheck()),
    await safeHealth(() => fcm.healthCheck()),
    await safeHealth(() => yoco.healthCheck()),
    await safeHealth(() => openai.healthCheck()),
    analyticsHealth.ga4 || (await safeHealth(() => analytics.getGa4Status())),
    analyticsHealth.searchConsole ||
      (await safeHealth(() => analytics.getSearchConsoleStatus())),
    await safeHealth(() => googleCalendar.healthCheck()),
    await safeHealth(() => microsoftGraph.healthCheck()),
  ].map((item) => ({
    ...item,
    lastChecked: item.lastChecked || checkedAt,
  }))

  const summary = {
    total: integrations.length,
    configured: integrations.filter((i) => i.status === 'configured').length,
    missing: integrations.filter((i) => i.status === 'missing').length,
    error: integrations.filter((i) => i.status === 'error').length,
  }

  return {
    ok: true,
    checkedAt,
    summary,
    integrations,
  }
}

module.exports = {
  getIntegrationsHealth,
}
