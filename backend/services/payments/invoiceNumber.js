/**
 * Shared TenderBriefing invoice numbering (idempotent stamp on requests).
 */
const crypto = require('crypto')

function nextInvoiceNumber() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `TB-INV-${y}${m}${day}-${suffix}`
}

/**
 * Stamp invoice fields once — never re-mint on refresh/retry.
 * @returns {{ request: object, minted: boolean }}
 */
function ensureInvoiceOnRequest(request, { now = new Date().toISOString() } = {}) {
  if (!request || typeof request !== 'object') {
    return { request, minted: false }
  }
  if (request.invoiceNumber) {
    return {
      request: {
        ...request,
        invoiceStatus:
          request.invoiceStatus ||
          (request.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'),
      },
      minted: false,
    }
  }
  // Free / not_required bookings do not need commercial invoices.
  if (request.paymentStatus === 'not_required') {
    return { request, minted: false }
  }
  return {
    request: {
      ...request,
      invoiceNumber: nextInvoiceNumber(),
      invoiceIssuedAt: request.invoiceIssuedAt || now,
      invoiceStatus: request.paymentStatus === 'paid' ? 'PAID' : 'UNPAID',
    },
    minted: true,
  }
}

module.exports = {
  nextInvoiceNumber,
  ensureInvoiceOnRequest,
}
