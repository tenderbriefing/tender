import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function storage() {
  return require('../../../../../backend/services/storageAdapter').getStorage()
}

function matchesQuery(tender: Record<string, unknown>, q: string) {
  const needle = q.toLowerCase()
  const hay = [
    tender.tenderNumber,
    tender.title,
    tender.description,
    tender.department,
    tender.buyer,
    tender.province,
    tender.ocid,
    tender.status,
    tender.briefingVenue,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' | ')
  return hay.includes(needle)
}

/**
 * Admin eTenders mirror search — finds records regardless of briefing status.
 * GET ?q=&status=&limit=
 * POST { action: 'reconcile', lookbackDays?, sampleSize? }
 */
export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const { searchParams } = new URL(request.url)
    const q = String(searchParams.get('q') || '').trim()
    const status = String(searchParams.get('status') || '').trim()
    const derived = String(searchParams.get('derivedBriefingStatus') || '').trim()
    const limit = Math.min(Math.max(1, Number(searchParams.get('limit') || 50)), 200)

    const all = await storage().getTenderBriefings({ limit: 5000 })
    let rows = Array.isArray(all) ? all : []

    if (q) rows = rows.filter((t: Record<string, unknown>) => matchesQuery(t, q))
    if (status) {
      rows = rows.filter(
        (t: Record<string, unknown>) =>
          String(t.status || '').toLowerCase() === status.toLowerCase()
      )
    }
    if (derived) {
      rows = rows.filter(
        (t: Record<string, unknown>) =>
          String(t.derivedBriefingStatus || '') === derived
      )
    }

    const data = rows.slice(0, limit).map((t: Record<string, unknown>) => ({
      id: t.id,
      ocid: t.ocid,
      tenderNumber: t.tenderNumber,
      title: t.title,
      department: t.department,
      province: t.province,
      status: t.status,
      publishedDate: t.publishedDate,
      closingDate: t.closingDate,
      briefingDate: t.briefingDate,
      briefingTime: t.briefingTime,
      briefingVenue: t.briefingVenue,
      sourceBriefingCompulsory: t.sourceBriefingCompulsory ?? null,
      derivedBriefingStatus: t.derivedBriefingStatus || null,
      briefingCompulsory: t.briefingCompulsory === true,
      documentCount: Array.isArray(t.documents) ? t.documents.length : 0,
      lastSyncedAt: t.lastSyncedAt || null,
      detailUrl: t.detailUrl || null,
    }))

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      totalMatched: rows.length,
      policy: {
        mirrorSearch: true,
        compulsoryFilter: false,
        note: 'Admin mirror includes non-compulsory and past-briefing records',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Mirror search failed',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').trim()
    if (action !== 'reconcile') {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      )
    }

    const recon = require('../../../../../backend/services/ocdsMirrorReconciliationService')
    const result = await recon.reconcileAndSample({
      lookbackDays: Number(body.lookbackDays) || 30,
      sampleSize: Number(body.sampleSize) || 25,
      dateFrom: body.dateFrom || undefined,
      dateTo: body.dateTo || undefined,
      maxPages: Number(body.maxPages) || undefined,
    })

    return NextResponse.json({
      success: true,
      data: result,
      triggeredBy: user.uid,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed',
      },
      { status: 500 }
    )
  }
}
