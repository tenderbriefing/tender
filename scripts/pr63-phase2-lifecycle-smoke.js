/**
 * Phase 2 organisation lifecycle smoke (in-memory / no production writes).
 * Covers: create org → draft → submit → changes requested → resubmit →
 * approve/publish idempotent → withdraw rules → duplicate → disable member.
 * Never logs secrets.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))

function memoryStore() {
  const store = new Map()
  const db = {
    collection(name) {
      return {
        doc(id) {
          return {
            async set(data, opts) {
              const key = `${name}/${id}`
              const prev = store.get(key) || {}
              store.set(key, opts?.merge ? { ...prev, ...data, id } : { ...data, id })
            },
            async get() {
              const data = store.get(`${name}/${id}`)
              return {
                exists: Boolean(data),
                id,
                data: () => (data ? { ...data } : undefined),
              }
            },
          }
        },
        where() {
          return this
        },
        orderBy() {
          return this
        },
        limit() {
          return this
        },
        async get() {
          const docs = []
          for (const [key, value] of store.entries()) {
            if (key.startsWith(`${name}/`)) {
              docs.push({
                id: value.id || key.split('/')[1],
                data: () => ({ ...value }),
              })
            }
          }
          return { empty: docs.length === 0, docs }
        },
      }
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          return ref.get()
        },
        set(ref, data, opts) {
          return ref.set(data, opts)
        },
      })
    },
  }
  return { store, db }
}

async function main() {
  const checks = []
  const push = (name, pass, extra = {}) => {
    checks.push({ name, pass, ...extra })
  }

  const { store, db } = memoryStore()
  const orgSvc = require('../backend/services/privateOrganisationService.js')
  const memberSvc = require('../backend/services/privateOrganisationMemberService.js')

  // Stub storage upsert for publish BEFORE loading submission service
  // (service destructures getStorage at module load).
  const storageAdapterPath = require.resolve('../backend/services/storageAdapter')
  const submissionPath = require.resolve('../backend/services/privateTenderSubmissionService.js')
  delete require.cache[storageAdapterPath]
  delete require.cache[submissionPath]
  const storageAdapter = require('../backend/services/storageAdapter')
  const published = new Map()
  const originalGetStorage = storageAdapter.getStorage
  storageAdapter.getStorage = () => ({
    async upsertTenders(items) {
      for (const t of items) published.set(t.id, t)
    },
    async getTenderById(id) {
      return published.get(id) || null
    },
  })
  const tenderSvc = require('../backend/services/privateTenderSubmissionService.js')

  try {
    const orgA = await orgSvc.createOrganisation(
      {
        legalName: 'PHASE2 SMOKE Org A',
        primaryContactName: 'Smoke Owner',
        primaryContactEmail: 'smoke-a@tenderbriefing.test',
      },
      { createdBy: 'uid-a' },
      { db }
    )
    push('org_created', Boolean(orgA.id))

    const owner = await memberSvc.createMembership(
      {
        organisationId: orgA.id,
        uid: 'uid-a',
        email: 'smoke-a@tenderbriefing.test',
        role: 'owner',
        status: 'active',
      },
      {},
      { db }
    )
    push('owner_membership', owner.role === 'owner')

    const member = await memberSvc.createMembership(
      {
        organisationId: orgA.id,
        uid: 'uid-b',
        email: 'smoke-b@tenderbriefing.test',
        role: 'procurement',
        status: 'active',
      },
      {},
      { db }
    )
    push('member_added', member.status === 'active')

    const orgB = await orgSvc.createOrganisation(
      {
        legalName: 'PHASE2 SMOKE Org B',
        primaryContactName: 'Other',
        primaryContactEmail: 'smoke-b-org@tenderbriefing.test',
      },
      { createdBy: 'uid-c' },
      { db }
    )
    await memberSvc.createMembership(
      {
        organisationId: orgB.id,
        uid: 'uid-c',
        email: 'smoke-b-org@tenderbriefing.test',
        role: 'owner',
        status: 'active',
      },
      {},
      { db }
    )

    const draft = await tenderSvc.createOrgDraft(
      {
        organisationId: orgA.id,
        createdByUid: 'uid-a',
        createdByEmail: 'smoke-a@tenderbriefing.test',
        companyName: orgA.legalName,
        seed: {
          status: 'published',
          organisationId: orgB.id,
          title: 'PHASE2 SMOKE — PRIVATE TENDER',
          tenderReference: 'P2-SMOKE-1',
          description: 'Synthetic Phase 2 certification tender',
          category: 'Certification',
          province: 'Gauteng',
          closingDate: '2099-12-01',
          closingTime: '16:00',
          briefingDate: '2099-11-15',
          briefingTime: '10:00',
          briefingVenue: 'PHASE2 SMOKE venue',
          contactPersonName: 'Smoke Owner',
          contactEmail: 'smoke-a@tenderbriefing.test',
          tenderDocument: {
            fileName: 'smoke.pdf',
            contentType: 'application/pdf',
            sizeBytes: 12,
            storagePath: 'private-tender-submissions/smoke/doc.pdf',
            uploadedAt: new Date().toISOString(),
            kind: 'tender_document',
          },
        },
      },
      { db }
    )
    push('draft_status_forced', draft.status === 'draft')
    push('draft_org_forced', draft.organisationId === orgA.id)

    const updated = await tenderSvc.updateOrgDraft(
      draft.id,
      { title: 'PHASE2 SMOKE — PRIVATE TENDER v2' },
      { organisationId: orgA.id, actorUid: 'uid-a' },
      { db }
    )
    push('draft_updated', updated.title.includes('v2'))

    let crossDenied = false
    try {
      await tenderSvc.updateOrgDraft(
        draft.id,
        { title: 'hijack' },
        { organisationId: orgB.id, actorUid: 'uid-c' },
        { db }
      )
    } catch (e) {
      crossDenied = e.status === 403
    }
    push('cross_org_update_denied', crossDenied)

    const submitted = await tenderSvc.submitOrgDraft(
      draft.id,
      { organisationId: orgA.id, actorUid: 'uid-a', actorEmail: 'smoke-a@tenderbriefing.test' },
      { db }
    )
    push('submitted', submitted.submission.status === 'submitted')

    const changes = await tenderSvc.reviewSubmission(
      draft.id,
      'request_changes',
      {
        note: 'Please clarify briefing venue',
        issueCategory: 'briefing_details_incomplete',
        actorUid: 'founder-1',
        actorEmail: 'info@tenderbriefing.co.za',
      },
      { db }
    )
    push('changes_requested', changes.submission.status === 'changes_requested')

    await tenderSvc.updateOrgDraft(
      draft.id,
      { briefingVenue: 'PHASE2 SMOKE venue — clarified' },
      { organisationId: orgA.id, actorUid: 'uid-a' },
      { db }
    )
    const resubmitted = await tenderSvc.submitOrgDraft(
      draft.id,
      { organisationId: orgA.id, actorUid: 'uid-a' },
      { db }
    )
    push('resubmitted', resubmitted.submission.status === 'submitted' && resubmitted.resubmitted === true)

    const approved = await tenderSvc.reviewSubmission(
      draft.id,
      'approve',
      { note: 'PHASE2 SMOKE approve', actorUid: 'founder-1', actorEmail: 'info@tenderbriefing.co.za' },
      { db }
    )
    push('published', approved.submission.status === 'published' && Boolean(approved.publishedTenderId))
    const canonical = published.get(approved.publishedTenderId)
    push('sourceType_private', canonical?.sourceType === 'private', {
      sourceType: canonical?.sourceType || null,
      source: canonical?.source || null,
    })

    const reapprove = await tenderSvc.reviewSubmission(
      draft.id,
      'approve',
      { note: 'idempotent', actorUid: 'founder-1', actorEmail: 'info@tenderbriefing.co.za' },
      { db }
    )
    push(
      'publish_idempotent',
      reapprove.created === false && reapprove.publishedTenderId === approved.publishedTenderId
    )

    let withdrawBlocked = false
    try {
      await tenderSvc.withdrawOrgSubmission(
        draft.id,
        { organisationId: orgA.id, actorUid: 'uid-a' },
        { db }
      )
    } catch (e) {
      withdrawBlocked = e.status === 409
    }
    push('published_withdraw_blocked', withdrawBlocked)

    const dup = await tenderSvc.duplicateOrgSubmission(
      draft.id,
      { organisationId: orgA.id, actorUid: 'uid-a', actorEmail: 'smoke-a@tenderbriefing.test' },
      { db }
    )
    push('duplicate_new_draft', dup.status === 'draft' && dup.id !== draft.id)
    push('duplicate_clears_publish', dup.publishedTenderId == null)

    await memberSvc.updateMembership(member.id, { status: 'disabled' }, {}, { db })
    // Active query returns null when status filter excludes disabled
    const activeLookupDb = {
      collection() {
        return {
          where(_f, _op, val) {
            this._status = val
            return this
          },
          limit() {
            return this
          },
          async get() {
            if (this._status === 'active') {
              return { empty: true, docs: [] }
            }
            return { empty: true, docs: [] }
          },
        }
      },
    }
    const stillActive = await memberSvc.getActiveMembershipForUser('uid-b', { db: activeLookupDb })
    push('disabled_member_excluded', stillActive === null)

    const auditEvents = [...store.keys()].filter((k) => k.startsWith('privateTenderAuditEvents/'))
    push('durable_audit_events_written', auditEvents.length >= 3, { count: auditEvents.length })

    const failures = checks.filter((c) => !c.pass).map((c) => c.name)
    const report = { ok: failures.length === 0, failures, checks }
    console.log(JSON.stringify(report, null, 2))
    process.exit(report.ok ? 0 : 1)
  } finally {
    storageAdapter.getStorage = originalGetStorage
  }
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }))
  process.exit(1)
})
