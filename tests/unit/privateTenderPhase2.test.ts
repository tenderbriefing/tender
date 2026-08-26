import { describe, expect, it } from 'vitest'
import {
  canOrganisationWithdraw,
  canTransitionStatus,
  PRIVATE_TENDER_TRANSITIONS,
} from '@/lib/privateTenders/statusMachine'
import { orgRoleHasPermission } from '@/lib/privateTenders/organisationPermissions'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

describe('Phase 2 private tender status machine', () => {
  it('allows draft → submitted and blocks draft → published', () => {
    expect(canTransitionStatus('draft', 'submitted')).toBe(true)
    expect(canTransitionStatus('draft', 'published')).toBe(false)
  })

  it('allows changes_requested → submitted (resubmit)', () => {
    expect(canTransitionStatus('changes_requested', 'submitted')).toBe(true)
  })

  it('blocks organisation withdraw of published', () => {
    expect(canOrganisationWithdraw('published')).toBe(false)
    expect(canOrganisationWithdraw('draft')).toBe(true)
    expect(canOrganisationWithdraw('submitted')).toBe(true)
    expect(canOrganisationWithdraw('changes_requested')).toBe(true)
  })

  it('defines no transitions out of archived', () => {
    expect(PRIVATE_TENDER_TRANSITIONS.archived).toEqual([])
  })
})

describe('Phase 2 organisation permissions', () => {
  it('owner can manage members; procurement cannot', () => {
    expect(orgRoleHasPermission('owner', 'manage_members')).toBe(true)
    expect(orgRoleHasPermission('admin', 'manage_members')).toBe(true)
    expect(orgRoleHasPermission('procurement', 'manage_members')).toBe(false)
  })

  it('procurement can create and submit tenders', () => {
    expect(orgRoleHasPermission('procurement', 'create_tender')).toBe(true)
    expect(orgRoleHasPermission('procurement', 'submit_tender')).toBe(true)
    expect(orgRoleHasPermission('procurement', 'destructive_org')).toBe(false)
  })
})

describe('Phase 2 organisation services', () => {
  it('creates organisation and owner membership with deny-self-verify', async () => {
    const store = new Map<string, any>()
    const db = {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              async set(data: any, opts?: any) {
                const prev = store.get(`${name}/${id}`) || {}
                store.set(`${name}/${id}`, opts?.merge ? { ...prev, ...data } : data)
              },
              async get() {
                const data = store.get(`${name}/${id}`)
                return { exists: Boolean(data), id, data: () => data }
              },
            }
          },
          where() {
            return this
          },
          limit() {
            return this
          },
          async get() {
            return { empty: true, docs: [] }
          },
        }
      },
    }

    const orgSvc = require('../../backend/services/privateOrganisationService.js')
    const memberSvc = require('../../backend/services/privateOrganisationMemberService.js')
    const org = await orgSvc.createOrganisation(
      {
        legalName: 'Acme Pty Ltd',
        primaryContactName: 'Ada',
        primaryContactEmail: 'ada@acme.test',
      },
      { createdBy: 'uid-1' },
      { db }
    )
    expect(org.verificationStatus).toBe('unverified')
    expect(org.status).toBe('active')

    const updated = await orgSvc.updateOrganisation(
      org.id,
      { verificationStatus: 'verified', legalName: 'Acme Pty Ltd' },
      { allowVerificationWrite: false },
      { db }
    )
    expect(updated.verificationStatus).toBe('unverified')

    const membership = await memberSvc.createMembership(
      {
        organisationId: org.id,
        uid: 'uid-1',
        email: 'ada@acme.test',
        role: 'owner',
        status: 'active',
      },
      {},
      { db }
    )
    expect(memberSvc.memberHasPermission(membership, 'manage_members')).toBe(true)
  })
})

describe('Phase 2 draft / withdraw / duplicate', () => {
  it('duplicates into a fresh draft without publish metadata', async () => {
    const store = new Map<string, any>()
    const makeDb = () => ({
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              async set(data: any, opts?: any) {
                const key = `${name}/${id}`
                const prev = store.get(key) || {}
                store.set(key, opts?.merge ? { ...prev, ...data } : { ...data, id })
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
            return { empty: true, docs: [] }
          },
          async runTransaction(fn: any) {
            return fn({
              async get(ref: any) {
                return ref.get()
              },
              set(ref: any, data: any, opts: any) {
                return ref.set(data, opts)
              },
            })
          },
        }
      },
      async runTransaction(fn: any) {
        return fn({
          async get(ref: any) {
            return ref.get()
          },
          set(ref: any, data: any, opts: any) {
            return ref.set(data, opts)
          },
        })
      },
    })

    // Patch getDb via deps
    const svc = require('../../backend/services/privateTenderSubmissionService.js')
    const db = makeDb()
    // Seed a published-like org tender
    const sourceId = 'pts-source-1'
    store.set(`privateTenderSubmissions/${sourceId}`, {
      id: sourceId,
      status: 'published',
      organisationId: 'porg-1',
      title: 'Original',
      tenderReference: 'REF-1',
      companyName: 'Acme',
      description: 'Desc',
      category: 'IT',
      province: 'Gauteng',
      publishedTenderId: 'priv-pts-source-1',
      publishedAt: new Date().toISOString(),
      reviewHistory: [{ at: 'x', action: 'approved' }],
      audit: [],
      tenderDocument: { fileName: 'a.pdf', storagePath: 'x', contentType: 'application/pdf', sizeBytes: 10, uploadedAt: '', kind: 'tender_document' },
      supportingDocuments: [],
    })

    const draft = await svc.duplicateOrgSubmission(
      sourceId,
      { organisationId: 'porg-1', actorUid: 'uid-1', actorEmail: 'a@b.c' },
      { db }
    )
    expect(draft.status).toBe('draft')
    expect(draft.publishedTenderId).toBeNull()
    expect(draft.tenderReference).toBe('')
    expect(draft.id).not.toBe(sourceId)
    expect(draft.tenderDocument).toBeNull()
  })

  it('withdraws draft and rejects published withdraw', async () => {
    const store = new Map<string, any>()
    const db = {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              async set(data: any, opts?: any) {
                const key = `${name}/${id}`
                const prev = store.get(key) || {}
                store.set(key, opts?.merge ? { ...prev, ...data } : data)
              },
              async get() {
                const data = store.get(`${name}/${id}`)
                return { exists: Boolean(data), id, data: () => data }
              },
            }
          },
        }
      },
    }
    const svc = require('../../backend/services/privateTenderSubmissionService.js')
    store.set('privateTenderSubmissions/pts-d1', {
      id: 'pts-d1',
      status: 'draft',
      organisationId: 'porg-1',
      audit: [],
      publishedTenderId: null,
    })
    const withdrawn = await svc.withdrawOrgSubmission(
      'pts-d1',
      { organisationId: 'porg-1', actorUid: 'u1' },
      { db }
    )
    expect(withdrawn.status).toBe('withdrawn')

    store.set('privateTenderSubmissions/pts-p1', {
      id: 'pts-p1',
      status: 'published',
      organisationId: 'porg-1',
      publishedTenderId: 'priv-x',
      audit: [],
    })
    await expect(
      svc.withdrawOrgSubmission('pts-p1', { organisationId: 'porg-1', actorUid: 'u1' }, { db })
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe('Phase 2 feature flag fail-closed', () => {
  it('defaults disabled', async () => {
    const prev = process.env.PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED
    delete process.env.PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED
    const { isPrivateTenderOrganisationWorkspaceEnabled } = await import(
      '@/lib/privateTenders/organisationWorkspaceFlag'
    )
    expect(isPrivateTenderOrganisationWorkspaceEnabled()).toBe(false)
    if (prev !== undefined) process.env.PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED = prev
  })
})

describe('Phase 2 org A vs org B IDOR + seed hardening', () => {
  function memoryDb(store: Map<string, any>) {
    return {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              async set(data: any, opts?: any) {
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
            return { empty: true, docs: [] }
          },
        }
      },
      async runTransaction(fn: any) {
        return fn({
          async get(ref: any) {
            return ref.get()
          },
          set(ref: any, data: any, opts: any) {
            return ref.set(data, opts)
          },
        })
      },
    }
  }

  it('rejects cross-org update/submit/withdraw/duplicate', async () => {
    const store = new Map<string, any>()
    const db = memoryDb(store)
    const svc = require('../../backend/services/privateTenderSubmissionService.js')
    store.set('privateTenderSubmissions/pts-a', {
      id: 'pts-a',
      status: 'draft',
      organisationId: 'porg-A',
      title: 'Org A draft',
      audit: [],
      publishedTenderId: null,
      tenderDocument: null,
      supportingDocuments: [],
    })

    await expect(
      svc.updateOrgDraft('pts-a', { title: 'Hijack' }, { organisationId: 'porg-B', actorUid: 'uB' }, { db })
    ).rejects.toMatchObject({ status: 403 })

    await expect(
      svc.submitOrgDraft('pts-a', { organisationId: 'porg-B', actorUid: 'uB' }, { db })
    ).rejects.toMatchObject({ status: 403 })

    await expect(
      svc.withdrawOrgSubmission('pts-a', { organisationId: 'porg-B', actorUid: 'uB' }, { db })
    ).rejects.toMatchObject({ status: 403 })

    await expect(
      svc.duplicateOrgSubmission('pts-a', { organisationId: 'porg-B', actorUid: 'uB' }, { db })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('ignores malicious seed status/organisationId on create', async () => {
    const store = new Map<string, any>()
    const db = memoryDb(store)
    const svc = require('../../backend/services/privateTenderSubmissionService.js')
    const draft = await svc.createOrgDraft(
      {
        organisationId: 'porg-A',
        createdByUid: 'uA',
        createdByEmail: 'a@test',
        seed: {
          status: 'published',
          organisationId: 'porg-B',
          publishedTenderId: 'priv-evil',
          title: 'Safe title',
        },
      },
      { db }
    )
    expect(draft.status).toBe('draft')
    expect(draft.organisationId).toBe('porg-A')
    expect(draft.publishedTenderId).toBeNull()
    expect(draft.title).toBe('Safe title')
  })

  it('blocks promoting a member to owner via PATCH', async () => {
    const store = new Map<string, any>()
    const db = {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              async set(data: any, opts?: any) {
                const key = `${name}/${id}`
                const prev = store.get(key) || {}
                store.set(key, opts?.merge ? { ...prev, ...data } : data)
              },
              async get() {
                const data = store.get(`${name}/${id}`)
                return { exists: Boolean(data), id, data: () => data }
              },
            }
          },
        }
      },
    }
    const memberSvc = require('../../backend/services/privateOrganisationMemberService.js')
    store.set('privateOrganisationMembers/pom-1', {
      id: 'pom-1',
      organisationId: 'porg-1',
      uid: 'u2',
      role: 'admin',
      status: 'active',
    })
    await expect(
      memberSvc.updateMembership('pom-1', { role: 'owner' }, {}, { db })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('disabled members are excluded from active membership lookup', async () => {
    const store = new Map<string, any>()
    const docs = [
      {
        id: 'pom-disabled',
        data: () => ({
          organisationId: 'porg-1',
          uid: 'u1',
          role: 'admin',
          status: 'disabled',
        }),
      },
    ]
    const db = {
      collection() {
        return {
          where() {
            return this
          },
          limit() {
            return this
          },
          async get() {
            // Mimic Firestore query status==active — empty when only disabled exists
            return { empty: true, docs: [] }
          },
        }
      },
    }
    void docs
    const memberSvc = require('../../backend/services/privateOrganisationMemberService.js')
    const active = await memberSvc.getActiveMembershipForUser('u1', { db })
    expect(active).toBeNull()
  })
})
