const { classifyTender } = require('./tenderClassificationService')
const { enrichProvince } = require('./provinceDetectionService')
const { enrichFromDocuments } = require('./documentExtractionService')
const { generateSummary } = require('./aiSummaryService')
const { scoreTender } = require('./opportunityScoringService')
const { buildCalendarEvents } = require('./calendarService')
const { applyHistory, hasChanged } = require('./tenderHistoryService')
const notificationService = require('./notificationService')
const auditLogService = require('./auditLogService')
const { contentHash } = require('./tenderModel')

async function processTender(tender, existing = null, options = {}) {
  const skipDocuments = options.skipDocuments === true
  const previousHash = existing?.contentHash

  let processed = { ...tender }
  processed = classifyTender(processed)
  processed = enrichProvince(processed)

  if (!skipDocuments && (processed.documents || []).length > 0) {
    try {
      processed = await enrichFromDocuments(processed)
      await auditLogService.logEvent({
        type: 'document_extraction',
        entityId: processed.id,
        status: 'completed',
      })
    } catch (error) {
      await auditLogService.logEvent({
        type: 'document_extraction',
        entityId: processed.id,
        status: 'failed',
        error: error.message,
      })
    }
  }

  processed = await generateSummary(processed)
  processed = scoreTender(processed)
  processed = buildCalendarEvents(processed)
  processed.contentHash = contentHash(processed)
  processed.lastSyncedAt = new Date().toISOString()

  if (existing) {
    processed = applyHistory(existing, processed)
    if (hasChanged(existing, processed)) {
      await notificationService.processTenderChangeNotifications(existing, processed)
      await auditLogService.logEvent({
        type: 'data_update',
        entityId: processed.id,
        ocid: processed.ocid,
      })
    }
  } else if (previousHash !== processed.contentHash) {
    await auditLogService.logEvent({
      type: 'tender_created',
      entityId: processed.id,
      ocid: processed.ocid,
    })
  }

  return processed
}

module.exports = {
  processTender,
}
