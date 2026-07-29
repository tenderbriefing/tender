/**
 * Support tickets — SME/agent/guest create, admin reply & status.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const COL = 'supportTickets'

const CATEGORIES = [
  'general',
  'payment',
  'attendance',
  'agent',
  'account',
  'technical',
  'billing',
  'other',
]

const STATUSES = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

function nowIso() {
  return new Date().toISOString()
}

function db() {
  return getFirestore()
}

function normalize(data, id) {
  return { id, ...data }
}

function makeMessage({ authorUid, authorRole, authorName, body }) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    authorUid: authorUid || null,
    authorRole: authorRole || 'user',
    authorName: authorName || 'User',
    body: String(body || '').trim(),
    createdAt: nowIso(),
  }
}

async function createTicket(payload, actor = null) {
  const timestamp = nowIso()
  const subject = String(payload.subject || '').trim()
  const body = String(payload.body || payload.message || '').trim()
  const email = String(payload.email || actor?.email || '')
    .trim()
    .toLowerCase()
  const name = String(payload.name || actor?.displayName || actor?.companyName || '').trim()

  if (!subject || subject.length < 3) throw new Error('Subject is required (min 3 characters)')
  if (!body || body.length < 10) throw new Error('Message is required (min 10 characters)')
  if (!email || !email.includes('@')) throw new Error('A valid email is required')

  const category = CATEGORIES.includes(payload.category) ? payload.category : 'general'
  const priority = PRIORITIES.includes(payload.priority) ? payload.priority : 'normal'
  const firstMessage = makeMessage({
    authorUid: actor?.uid || null,
    authorRole: actor?.userType === 'admin' ? 'admin' : actor ? actor.userType : 'guest',
    authorName: name || 'Requester',
    body,
  })

  const ticket = sanitizeFirestoreData({
    subject: subject.slice(0, 200),
    category,
    status: 'open',
    priority,
    requesterUid: actor?.uid || null,
    requesterEmail: email.slice(0, 200),
    requesterName: (name || 'Guest').slice(0, 120),
    requesterUserType: actor?.userType || 'guest',
    source: payload.source || 'support',
    relatedRequestId: payload.relatedRequestId || null,
    relatedTenderId: payload.relatedTenderId || null,
    messages: [firstMessage],
    messageCount: 1,
    lastMessageAt: timestamp,
    lastMessagePreview: body.slice(0, 160),
    lastAuthorRole: firstMessage.authorRole,
    adminAssigneeUid: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
  })

  const ref = await db().collection(COL).add(ticket)
  return normalize(ticket, ref.id)
}

async function getTicket(ticketId) {
  const doc = await db().collection(COL).doc(ticketId).get()
  if (!doc.exists) return null
  return normalize(doc.data(), doc.id)
}

async function listTickets(filters = {}) {
  let snap
  try {
    snap = await db().collection(COL).orderBy('updatedAt', 'desc').limit(300).get()
  } catch {
    snap = await db().collection(COL).limit(300).get()
  }

  let items = snap.docs.map((d) => normalize(d.data(), d.id))
  items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))

  if (filters.requesterUid) {
    items = items.filter((t) => t.requesterUid === filters.requesterUid)
  }
  if (filters.email) {
    const email = String(filters.email).toLowerCase()
    items = items.filter((t) => (t.requesterEmail || '').toLowerCase() === email)
  }
  if (filters.status) items = items.filter((t) => t.status === filters.status)
  if (filters.category) items = items.filter((t) => t.category === filters.category)
  if (filters.openOnly) {
    items = items.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_on_user')
  }
  if (filters.search) {
    const s = String(filters.search).toLowerCase()
    items = items.filter(
      (t) =>
        (t.subject || '').toLowerCase().includes(s) ||
        (t.requesterEmail || '').toLowerCase().includes(s) ||
        (t.requesterName || '').toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s)
    )
  }
  return items
}

async function addMessage(ticketId, { body, actor, isInternal = false }) {
  const ticket = await getTicket(ticketId)
  if (!ticket) throw new Error('Ticket not found')
  if (ticket.status === 'closed') throw new Error('This ticket is closed')

  const text = String(body || '').trim()
  if (!text || text.length < 2) throw new Error('Reply cannot be empty')

  const isAdmin = actor?.userType === 'admin'
  const message = makeMessage({
    authorUid: actor?.uid || null,
    authorRole: isAdmin ? (isInternal ? 'admin_internal' : 'admin') : actor?.userType || 'user',
    authorName: isAdmin
      ? actor.displayName || 'Support'
      : actor?.displayName || ticket.requesterName || 'User',
    body: text,
  })

  const messages = [...(ticket.messages || []), message]
  const timestamp = nowIso()
  let nextStatus = ticket.status
  if (isAdmin && !isInternal) {
    nextStatus = ticket.status === 'open' ? 'in_progress' : 'waiting_on_user'
  } else if (!isAdmin && (ticket.status === 'waiting_on_user' || ticket.status === 'resolved')) {
    nextStatus = 'open'
  }

  const patch = sanitizeFirestoreData({
    messages,
    messageCount: messages.length,
    lastMessageAt: timestamp,
    lastMessagePreview: text.slice(0, 160),
    lastAuthorRole: message.authorRole,
    status: nextStatus,
    updatedAt: timestamp,
  })

  await db().collection(COL).doc(ticketId).set(patch, { merge: true })
  return getTicket(ticketId)
}

async function updateTicket(ticketId, patch, adminUid) {
  const ticket = await getTicket(ticketId)
  if (!ticket) throw new Error('Ticket not found')

  const updates = {
    updatedAt: nowIso(),
    updatedBy: adminUid || null,
  }

  if (patch.status) {
    if (!STATUSES.includes(patch.status)) throw new Error('Invalid status')
    updates.status = patch.status
    if (patch.status === 'closed' || patch.status === 'resolved') {
      updates.closedAt = nowIso()
    } else {
      updates.closedAt = null
    }
  }
  if (patch.priority) {
    if (!PRIORITIES.includes(patch.priority)) throw new Error('Invalid priority')
    updates.priority = patch.priority
  }
  if (patch.category) {
    if (!CATEGORIES.includes(patch.category)) throw new Error('Invalid category')
    updates.category = patch.category
  }
  if (patch.adminAssigneeUid !== undefined) {
    updates.adminAssigneeUid = patch.adminAssigneeUid || null
  }

  await db().collection(COL).doc(ticketId).set(sanitizeFirestoreData(updates), { merge: true })
  return getTicket(ticketId)
}

async function getSupportStats() {
  const items = await listTickets({})
  const open = items.filter((t) => ['open', 'in_progress', 'waiting_on_user'].includes(t.status))
  return {
    total: items.length,
    open: open.length,
    openUrgent: open.filter((t) => t.priority === 'urgent' || t.priority === 'high').length,
    waitingOnUser: items.filter((t) => t.status === 'waiting_on_user').length,
    resolved: items.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
  }
}

function canUserAccessTicket(ticket, user) {
  if (!ticket || !user) return false
  if (user.userType === 'admin') return true
  if (ticket.requesterUid && ticket.requesterUid === user.uid) return true
  return false
}

module.exports = {
  COL,
  CATEGORIES,
  STATUSES,
  PRIORITIES,
  createTicket,
  getTicket,
  listTickets,
  addMessage,
  updateTicket,
  getSupportStats,
  canUserAccessTicket,
}
