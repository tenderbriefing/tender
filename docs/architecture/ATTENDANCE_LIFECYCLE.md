# Attendance Lifecycle

Workflow states (server-authoritative):  
`pending → assigned → accepted → en_route → arrived → in_progress → completed → closed`  
with `cancelled` / `disputed` branches.

Payment states:  
`pending/processing → paid` (ITN) with `failed/cancelled/refunded/disputed`.

**Rule:** Agents only become dispatch-visible when `paymentStatus` is `paid` or legacy `not_required`.

Transitions: `lib/domain/attendanceLifecycle.ts` + `lib/domain/paymentLifecycle.ts`.  
Firestore clients cannot write privileged attendance fields (see `firestore.rules`).
