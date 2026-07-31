/**
 * Authoritative attendance + payment lifecycle enforcement (CommonJS).
 * All privileged mutations in backend JS must go through this module.
 */

const WORKFLOW_STATES = [
  'pending',
  'assigned',
  'accepted',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'closed',
  'cancelled',
  'disputed',
]

const PAYMENT_STATES = [
  'created',
  'pending',
  'processing',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'refunded',
  'disputed',
  'not_required',
]

const WORKFLOW_ALLOWED = {
  pending: { assigned: ['admin', 'system', 'youth-agent'], cancelled: ['sme', 'admin'] },
  assigned: {
    accepted: ['youth-agent', 'admin'],
    pending: ['admin'],
    cancelled: ['sme', 'admin'],
    // Product historically sets status=assigned on accept; allow idempotent assigned→assigned
    assigned: ['youth-agent', 'admin', 'system'],
  },
  accepted: {
    en_route: ['youth-agent', 'admin'],
    cancelled: ['admin'],
    completed: ['youth-agent', 'admin'],
  },
  en_route: { arrived: ['youth-agent', 'admin'], cancelled: ['admin'] },
  arrived: {
    in_progress: ['youth-agent', 'admin'],
    completed: ['youth-agent', 'admin'],
  },
  in_progress: {
    completed: ['youth-agent', 'admin'],
    disputed: ['sme', 'admin', 'youth-agent'],
  },
  completed: { closed: ['admin', 'system'], disputed: ['sme', 'admin'] },
  closed: {},
  cancelled: {},
  disputed: { closed: ['admin'], completed: ['admin'] },
}

const PAYMENT_ALLOWED = {
  created: ['pending', 'cancelled', 'expired'],
  pending: ['processing', 'paid', 'failed', 'cancelled', 'expired'],
  processing: ['paid', 'failed', 'cancelled'],
  paid: ['refunded', 'disputed'],
  failed: ['pending', 'cancelled'],
  cancelled: [],
  expired: ['pending'],
  refunded: [],
  disputed: ['paid', 'refunded'],
  not_required: ['paid', 'cancelled'],
}

function normalizeWorkflow(raw) {
  if (!raw) return 'pending'
  if (raw === 'accepted') return 'accepted'
  return WORKFLOW_STATES.includes(raw) ? raw : 'pending'
}

function normalizePayment(raw) {
  if (!raw) return 'pending'
  return PAYMENT_STATES.includes(raw) ? raw : 'pending'
}

function assertWorkflowTransition(fromRaw, to, role) {
  const from = normalizeWorkflow(fromRaw)
  if (from === to) return { ok: true, from, to }
  const allowedRoles = WORKFLOW_ALLOWED[from]?.[to]
  if (!allowedRoles) {
    const err = new Error(`Invalid attendance transition: ${from} → ${to}`)
    err.code = 'lifecycle_transition_rejected'
    throw err
  }
  if (!allowedRoles.includes(role)) {
    const err = new Error(`Role ${role} cannot transition ${from} → ${to}`)
    err.code = 'lifecycle_transition_rejected'
    throw err
  }
  return { ok: true, from, to }
}

function assertPaymentTransition(fromRaw, to) {
  const from = normalizePayment(fromRaw)
  if (from === to) return { ok: true, from, to }
  if (!(PAYMENT_ALLOWED[from] || []).includes(to)) {
    const err = new Error(`Invalid payment transition: ${from} → ${to}`)
    err.code = 'payment_transition_rejected'
    throw err
  }
  return { ok: true, from, to }
}

function isDispatchablePayment(status) {
  const s = normalizePayment(status)
  return s === 'paid' || s === 'not_required'
}

/**
 * Apply a workflow transition onto a request object (mutates copy fields).
 */
function applyWorkflowTransition(request, to, { role, actorId, now = new Date().toISOString() }) {
  assertWorkflowTransition(request.status, to, role)
  const next = {
    ...request,
    status: to,
    updatedAt: now,
    lastTransitionAt: now,
    lastTransitionBy: actorId || null,
    lastTransitionRole: role,
  }
  if (to === 'assigned' || to === 'accepted') {
    next.acceptedAt = next.acceptedAt || now
  }
  if (to === 'completed') {
    next.completedAt = now
  }
  if (to === 'cancelled') {
    next.cancelledAt = now
  }
  return next
}

function applyPaymentTransition(request, to, { actorId, now = new Date().toISOString(), extra = {} } = {}) {
  assertPaymentTransition(request.paymentStatus, to)
  return {
    ...request,
    ...extra,
    paymentStatus: to,
    updatedAt: now,
    lastPaymentTransitionAt: now,
    lastPaymentTransitionBy: actorId || null,
  }
}

module.exports = {
  WORKFLOW_STATES,
  PAYMENT_STATES,
  normalizeWorkflow,
  normalizePayment,
  assertWorkflowTransition,
  assertPaymentTransition,
  isDispatchablePayment,
  applyWorkflowTransition,
  applyPaymentTransition,
}
