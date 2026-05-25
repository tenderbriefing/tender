/**
 * Invoices and payout statements.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso } = require('../ai/_shared')

async function generateInvoice(payload) {
  const db = getFirestore()
  const invoice = sanitizeFirestoreData({
    invoiceType: payload.invoiceType || 'enterprise',
    smeId: payload.smeId || null,
    agentId: payload.agentId || null,
    lineItems: payload.lineItems || [],
    totalCents: payload.totalCents || 0,
    currency: 'ZAR',
    status: 'draft',
    periodStart: payload.periodStart || null,
    periodEnd: payload.periodEnd || null,
    createdAt: nowIso(),
  })
  const ref = await db.collection('financeInvoices').add(invoice)
  return { id: ref.id, ...invoice }
}

async function listInvoices(limit = 40) {
  const db = getFirestore()
  const snap = await db.collection('financeInvoices').orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

module.exports = { generateInvoice, listInvoices }
