/**
 * Phase 18 — Durable day reconciliation records (Firestore + JSON fallback).
 */
const fs = require('fs')
const path = require('path')
const { emptyDayRecord, isIsoDate } = require('../domain/ocdsDayReconciliation')

const COLLECTION = 'ocdsDayReconciliation'
const JSON_FILE = path.join(process.cwd(), 'backend', 'data', 'ocds-day-reconciliation.json')

function useJsonFallback() {
  return String(process.env.STORAGE_ADAPTER || '').toLowerCase() !== 'firestore'
}

function readJsonAll() {
  try {
    if (!fs.existsSync(JSON_FILE)) return {}
    const raw = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function writeJsonAll(map) {
  fs.mkdirSync(path.dirname(JSON_FILE), { recursive: true })
  fs.writeFileSync(JSON_FILE, `${JSON.stringify(map, null, 2)}\n`, 'utf8')
}

async function getDayRecord(date) {
  const id = String(date || '').slice(0, 10)
  if (!isIsoDate(id)) return null

  if (!useJsonFallback()) {
    try {
      const { getFirebaseAdmin } = require('../config/firebaseAdmin')
      const snap = await getFirebaseAdmin().firestore().collection(COLLECTION).doc(id).get()
      if (snap.exists) return { id: snap.id, ...snap.data() }
      return null
    } catch (err) {
      if (String(process.env.STORAGE_ADAPTER || '').toLowerCase() === 'firestore') throw err
    }
  }

  const all = readJsonAll()
  return all[id] || null
}

async function saveDayRecord(record) {
  const id = String(record.date || record.id || '').slice(0, 10)
  if (!isIsoDate(id)) throw new Error('Invalid day record date')
  const doc = { ...emptyDayRecord(id), ...record, id, date: id, updatedAt: new Date().toISOString() }

  if (!useJsonFallback()) {
    try {
      const { getFirebaseAdmin } = require('../config/firebaseAdmin')
      await getFirebaseAdmin().firestore().collection(COLLECTION).doc(id).set(doc, { merge: true })
      return doc
    } catch (err) {
      if (String(process.env.STORAGE_ADAPTER || '').toLowerCase() === 'firestore') throw err
    }
  }

  const all = readJsonAll()
  all[id] = doc
  writeJsonAll(all)
  return doc
}

async function listDayRecords({ dateFrom, dateTo, status, limit = 120 } = {}) {
  const from = dateFrom ? String(dateFrom).slice(0, 10) : null
  const to = dateTo ? String(dateTo).slice(0, 10) : null
  const statusFilter = status ? String(status) : null
  const max = Math.min(Math.max(1, Number(limit) || 120), 400)

  if (!useJsonFallback()) {
    try {
      const { getFirebaseAdmin } = require('../config/firebaseAdmin')
      let query = getFirebaseAdmin().firestore().collection(COLLECTION).orderBy('date', 'desc')
      if (from) query = query.where('date', '>=', from)
      if (to) query = query.where('date', '<=', to)
      const snap = await query.limit(max).get()
      let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)
      return rows
    } catch (err) {
      // Composite index may be missing — fall through to full scan / JSON
      if (String(process.env.STORAGE_ADAPTER || '').toLowerCase() === 'firestore') {
        try {
          const { getFirebaseAdmin } = require('../config/firebaseAdmin')
          const snap = await getFirebaseAdmin().firestore().collection(COLLECTION).limit(500).get()
          let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          if (from) rows = rows.filter((r) => String(r.date) >= from)
          if (to) rows = rows.filter((r) => String(r.date) <= to)
          if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)
          rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))
          return rows.slice(0, max)
        } catch (inner) {
          throw inner
        }
      }
    }
  }

  const all = readJsonAll()
  let rows = Object.values(all)
  if (from) rows = rows.filter((r) => String(r.date) >= from)
  if (to) rows = rows.filter((r) => String(r.date) <= to)
  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return rows.slice(0, max)
}

async function ensurePendingDays(dates = []) {
  const out = []
  for (const date of dates) {
    const existing = await getDayRecord(date)
    if (existing) {
      out.push(existing)
      continue
    }
    const created = await saveDayRecord(emptyDayRecord(date))
    out.push(created)
  }
  return out
}

module.exports = {
  COLLECTION,
  getDayRecord,
  saveDayRecord,
  listDayRecords,
  ensurePendingDays,
  emptyDayRecord,
}
