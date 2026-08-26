import { NextRequest } from 'next/server'
import {
  jsonErr,
  jsonOk,
  requireProcurementAccess,
} from '@/lib/privateTenders/requireProcurementAccess'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const gated = await requireProcurementAccess(request, 'view_tenders')
    if ('response' in gated) return gated.response
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const svc = require('../../../../backend/services/privateTenderSubmissionService.js')
    const tenders = await svc.listOrgSubmissions(gated.ctx.organisation.id, {
      status: status || undefined,
      limit: 50,
    })
    return jsonOk({ tenders })
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : 'Failed to list tenders', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const gated = await requireProcurementAccess(request, 'create_tender')
    if ('response' in gated) return gated.response
    const body = await request.json().catch(() => ({}))
    const svc = require('../../../../backend/services/privateTenderSubmissionService.js')
    const safeBody =
      body && typeof body === 'object'
        ? {
            title: body.title,
            tenderReference: body.tenderReference,
            description: body.description,
            category: body.category,
            province: body.province,
            municipality: body.municipality,
            closingDate: body.closingDate,
            closingTime: body.closingTime,
            briefingDate: body.briefingDate,
            briefingTime: body.briefingTime,
            briefingVenue: body.briefingVenue,
            briefingInstructions: body.briefingInstructions,
            contactPersonName: body.contactPersonName,
            contactEmail: body.contactEmail,
            contactPhone: body.contactPhone,
          }
        : {}
    const tender = await svc.createOrgDraft({
      organisationId: gated.ctx.organisation.id,
      createdByUid: gated.ctx.uid,
      createdByEmail: gated.ctx.email,
      companyName: gated.ctx.organisation.legalName,
      seed: {
        companyName: gated.ctx.organisation.legalName,
        registrationNumber: gated.ctx.organisation.registrationNumber || '',
        website: gated.ctx.organisation.website || '',
        contactPersonName: gated.ctx.organisation.primaryContactName,
        contactEmail: gated.ctx.organisation.primaryContactEmail,
        contactPhone: gated.ctx.organisation.primaryContactPhone || '',
        ...safeBody,
      },
    })
    return jsonOk({ tender }, 201)
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return jsonErr(error instanceof Error ? error.message : 'Failed to create draft', status)
  }
}
