const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')

const JSON_FILES = {
  TENDER_BRIEFINGS: 'tender-briefings.json',
  SYNC_STATE: 'sync-state.json',
  ATTENDANCE_REQUESTS: 'attendance-requests.json',
  BRIEFING_REPORTS: 'briefing-reports.json',
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function getFilePath(collection) {
  ensureDataDir()
  return path.join(DATA_DIR, collection)
}

function readCollection(collection, defaultValue = []) {
  const filePath = getFilePath(collection)
  if (!fs.existsSync(filePath)) {
    writeCollection(collection, defaultValue)
    return structuredClone(defaultValue)
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return structuredClone(defaultValue)
  }
}

function writeCollection(collection, data) {
  const filePath = getFilePath(collection)
  ensureDataDir()
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

const defaultSyncState = () => ({
  lastSuccessfulSync: null,
  lastIncrementalSync: null,
  lastFullReconciliation: null,
  lastFailedSync: null,
  syncLogs: [],
  isRunning: false,
  lastError: null,
  apiHealth: 'unknown',
  scraperHealth: 'unknown',
  preservedTenderCount: null,
})

function applyTenderFilters(items, filters = {}) {
  let result = items
  if (filters.compulsoryOnly) {
    result = result.filter((t) => t.briefingCompulsory === true)
  }
  if (filters.province) {
    result = result.filter(
      (t) => t.province?.toLowerCase() === filters.province.toLowerCase()
    )
  }
  if (filters.sector) {
    result = result.filter(
      (t) => t.industrySector?.toLowerCase() === filters.sector.toLowerCase()
    )
  }
  if (filters.status) {
    result = result.filter((t) => t.status === filters.status)
  }
  return result.sort(
    (a, b) =>
      new Date(b.lastSyncedAt || b.scrapedAt || 0) -
      new Date(a.lastSyncedAt || a.scrapedAt || 0)
  )
}

class JsonStorageAdapter {
  get adapterType() {
    return 'json'
  }

  async getAllTenders(filters = {}) {
    return applyTenderFilters(readCollection(JSON_FILES.TENDER_BRIEFINGS, []), filters)
  }

  async getTenderBriefings(filters = {}) {
    return this.getAllTenders(filters)
  }

  async getTenderById(id) {
    const items = readCollection(JSON_FILES.TENDER_BRIEFINGS, [])
    return (
      items.find((t) => t.id === id || t.ocid === id || t.tenderNumber === id) || null
    )
  }

  async getTenderBriefingById(id) {
    return this.getTenderById(id)
  }

  async upsertTenders(tenders) {
    const items = readCollection(JSON_FILES.TENDER_BRIEFINGS, [])
    let written = 0

    for (const tender of tenders) {
      const index = items.findIndex(
        (t) =>
          t.id === tender.id ||
          (tender.ocid && t.ocid === tender.ocid) ||
          (tender.tenderNumber && t.tenderNumber === tender.tenderNumber)
      )
      if (index >= 0) items[index] = tender
      else items.push(tender)
      written += 1
    }

    writeCollection(JSON_FILES.TENDER_BRIEFINGS, items)
    return { written }
  }

  async saveTenderBriefing(tender) {
    await this.upsertTenders([tender])
    return tender
  }

  async saveTenderBriefings(tenders) {
    return this.upsertTenders(tenders)
  }

  async deleteTenderBriefing(id) {
    const items = readCollection(JSON_FILES.TENDER_BRIEFINGS, [])
    writeCollection(
      JSON_FILES.TENDER_BRIEFINGS,
      items.filter((t) => t.id !== id)
    )
  }

  async getSyncStatus() {
    return readCollection(JSON_FILES.SYNC_STATE, defaultSyncState())
  }

  async getSyncState() {
    return this.getSyncStatus()
  }

  async saveSyncStatus(state) {
    writeCollection(JSON_FILES.SYNC_STATE, state)
    return state
  }

  async saveSyncState(state) {
    return this.saveSyncStatus(state)
  }

  async getAttendanceRequests(filters = {}) {
    let items = readCollection(JSON_FILES.ATTENDANCE_REQUESTS, [])
    if (filters.smeId) items = items.filter((r) => r.smeId === filters.smeId)
    if (filters.agentId) {
      items = items.filter(
        (r) => r.agentId === filters.agentId || r.assignedAgentId === filters.agentId
      )
    }
    if (filters.status) {
      const st = filters.status === 'assigned' ? ['assigned', 'accepted'] : [filters.status]
      items = items.filter((r) => st.includes(r.status))
    }
    if (filters.availableForAgent) {
      const agentId = filters.availableForAgent
      items = items.filter((r) => {
        const status = r.status === 'accepted' ? 'assigned' : r.status
        if (status === 'pending') return true
        if (status === 'assigned' && (r.assignedAgentId === agentId || r.agentId === agentId)) {
          return true
        }
        return false
      })
    }
    return items.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    )
  }

  async saveAttendanceRequest(request) {
    const items = readCollection(JSON_FILES.ATTENDANCE_REQUESTS, [])
    const index = items.findIndex((r) => r.id === request.id)
    if (index >= 0) items[index] = request
    else items.push(request)
    writeCollection(JSON_FILES.ATTENDANCE_REQUESTS, items)
    return request
  }

  async getBriefingReports(filters = {}) {
    let items = readCollection(JSON_FILES.BRIEFING_REPORTS, [])
    if (filters.requestId) items = items.filter((r) => r.requestId === filters.requestId)
    if (filters.agentId) items = items.filter((r) => r.agentId === filters.agentId)
    if (filters.tenderId) items = items.filter((r) => r.tenderId === filters.tenderId)
    return items
  }

  async saveBriefingReport(report) {
    const items = readCollection(JSON_FILES.BRIEFING_REPORTS, [])
    const index = items.findIndex((r) => r.id === report.id)
    if (index >= 0) items[index] = report
    else items.push(report)
    writeCollection(JSON_FILES.BRIEFING_REPORTS, items)
    return report
  }

  async saveAuditLog(log) {
    const LOGS_DIR = path.join(__dirname, '..', 'logs')
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
    const date = new Date().toISOString().slice(0, 10)
    const entry = {
      id: log.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: log.timestamp || new Date().toISOString(),
      ...log,
    }
    fs.appendFileSync(
      path.join(LOGS_DIR, `audit-${date}.jsonl`),
      `${JSON.stringify(entry)}\n`,
      'utf8'
    )
    return entry
  }

  async getAuditLogs(filters = {}) {
    const LOGS_DIR = path.join(__dirname, '..', 'logs')
    if (!fs.existsSync(LOGS_DIR)) return []

    const limit = filters.limit || 200
    const entries = []
    const files = fs
      .readdirSync(LOGS_DIR)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
      .sort()
      .reverse()

    for (const file of files) {
      if (entries.length >= limit) break
      const lines = fs
        .readFileSync(path.join(LOGS_DIR, file), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .reverse()

      for (const line of lines) {
        if (entries.length >= limit) break
        try {
          const entry = JSON.parse(line)
          if (filters.type && entry.type !== filters.type) continue
          if (filters.entityId && entry.entityId !== filters.entityId) continue
          entries.push(entry)
        } catch {
          // skip malformed lines
        }
      }
    }

    return entries
  }
}

class FirestoreStorageAdapter {
  constructor() {
    this._service = null
    this.adapterType = 'firestore'
  }

  _getService() {
    if (!this._service) {
      this._service = require('./firestoreStorageService')
    }
    return this._service
  }

  async getAllTenders(filters) {
    return this._getService().getAllTenders(filters)
  }

  async getTenderBriefings(filters) {
    return this.getAllTenders(filters)
  }

  async getTenderById(id) {
    return this._getService().getTenderById(id)
  }

  async getTenderBriefingById(id) {
    return this.getTenderById(id)
  }

  async upsertTenders(tenders) {
    return this._getService().upsertTenders(tenders)
  }

  async saveTenderBriefing(tender) {
    return this.upsertTenders([tender]).then(() => tender)
  }

  async saveTenderBriefings(tenders) {
    return this.upsertTenders(tenders)
  }

  async deleteTenderBriefing(id) {
    const { getFirestore } = require('../config/firebaseAdmin')
    await getFirestore().collection('tenderBriefings').doc(id).delete()
  }

  async getSyncStatus() {
    return this._getService().getSyncStatus()
  }

  async getSyncState() {
    return this.getSyncStatus()
  }

  async saveSyncStatus(state) {
    return this._getService().saveSyncStatus(state)
  }

  async saveSyncState(state) {
    return this.saveSyncStatus(state)
  }

  async getAttendanceRequests(filters) {
    return this._getService().getAttendanceRequests(filters)
  }

  async saveAttendanceRequest(request) {
    return this._getService().saveAttendanceRequest(request)
  }

  async getBriefingReports(filters) {
    return this._getService().getBriefingReports(filters)
  }

  async saveBriefingReport(report) {
    return this._getService().saveBriefingReport(report)
  }

  async saveAuditLog(log) {
    return this._getService().saveAuditLog(log)
  }

  async getAuditLogs(filters) {
    return this._getService().getAuditLogs(filters)
  }

  async saveNotification(notification) {
    const svc = this._getService()
    if (typeof svc.saveNotification === 'function') {
      return svc.saveNotification(notification)
    }
    return notification
  }

  async getNotifications(filters) {
    const svc = this._getService()
    if (typeof svc.getNotifications === 'function') {
      return svc.getNotifications(filters)
    }
    return []
  }

  async markNotificationRead(notificationId) {
    const svc = this._getService()
    if (typeof svc.markNotificationRead === 'function') {
      return svc.markNotificationRead(notificationId)
    }
  }

  async markAllNotificationsRead(userId) {
    const svc = this._getService()
    if (typeof svc.markAllNotificationsRead === 'function') {
      return svc.markAllNotificationsRead(userId)
    }
  }
}

function createStorageAdapter() {
  const adapterType = (process.env.STORAGE_ADAPTER || 'json').toLowerCase()

  if (adapterType === 'firestore') {
    try {
      const { initializeFirebaseAdmin } = require('../config/firebaseAdmin')
      initializeFirebaseAdmin()
      console.log(
        `[TenderBriefing] Storage adapter: firestore (project: ${process.env.FIREBASE_PROJECT_ID || 'unknown'})`
      )
      return new FirestoreStorageAdapter()
    } catch (error) {
      console.error(`[TenderBriefing] Firestore adapter failed to initialize: ${error.message}`)
      throw error
    }
  }

  console.log('[TenderBriefing] Storage adapter: json (backend/data/)')
  return new JsonStorageAdapter()
}

let storageInstance = null

function getStorage() {
  if (!storageInstance) {
    storageInstance = createStorageAdapter()
  }
  return storageInstance
}

function resetStorage() {
  storageInstance = null
}

module.exports = {
  DATA_DIR,
  JSON_FILES,
  JsonStorageAdapter,
  FirestoreStorageAdapter,
  createStorageAdapter,
  getStorage,
  resetStorage,
  readCollection,
  writeCollection,
}
