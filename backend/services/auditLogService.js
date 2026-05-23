const fs = require('fs')
const path = require('path')
const { getStorage } = require('./storageAdapter')

const LOGS_DIR = path.join(__dirname, '..', 'logs')

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  }
}

function appendJsonlLog(entry) {
  ensureLogsDir()
  const date = new Date().toISOString().slice(0, 10)
  const filePath = path.join(LOGS_DIR, `audit-${date}.jsonl`)
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
}

async function logEvent(event) {
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...event,
  }

  const storage = getStorage()

  if (typeof storage.saveAuditLog === 'function') {
    try {
      return await storage.saveAuditLog(entry)
    } catch (error) {
      console.warn('Storage audit log failed, falling back to JSONL:', error.message)
    }
  }

  appendJsonlLog(entry)
  return entry
}

async function getAuditLogs(filters = {}) {
  const storage = getStorage()

  if (typeof storage.getAuditLogs === 'function') {
    try {
      const logs = await storage.getAuditLogs(filters)
      if (logs.length > 0 || (process.env.STORAGE_ADAPTER || 'json') === 'firestore') {
        return logs
      }
    } catch (error) {
      console.warn('Storage audit read failed, falling back to JSONL:', error.message)
    }
  }

  ensureLogsDir()
  const limit = filters.limit || 200
  const entries = []
  const files = fs
    .readdirSync(LOGS_DIR)
    .filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
    .sort()
    .reverse()

  for (const file of files) {
    if (entries.length >= limit) break
    const content = fs.readFileSync(path.join(LOGS_DIR, file), 'utf8')
    const lines = content.trim().split('\n').filter(Boolean).reverse()

    for (const line of lines) {
      if (entries.length >= limit) break
      try {
        const entry = JSON.parse(line)
        if (filters.type && entry.type !== filters.type) continue
        if (filters.entityId && entry.entityId !== filters.entityId) continue
        entries.push(entry)
      } catch {
        // skip malformed
      }
    }
  }

  return entries
}

module.exports = {
  LOGS_DIR,
  logEvent,
  getAuditLogs,
}
