import { NextRequest, NextResponse } from 'next/server'
import {
  jsonErr,
  jsonOk,
  requireProcurementAccess,
} from '@/lib/privateTenders/requireProcurementAccess'
import { isPrivateTenderOrganisationWorkspaceEnabled } from '@/lib/privateTenders/organisationWorkspaceFlag'
import {
  responseFromVerifyFailure,
  verifyApiUserDetailed,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const gated = await requireProcurementAccess(request, 'view_tenders')
    if ('response' in gated) {
      if (!isPrivateTenderOrganisationWorkspaceEnabled()) return gated.response
      const auth = await verifyApiUserDetailed(request.headers.get('authorization'), [
        'sme',
        'admin',
      ])
      if (auth.ok) {
        return jsonOk({ organisation: null, membership: null, needsOnboarding: true })
      }
      return responseFromVerifyFailure(auth) as unknown as NextResponse
    }
    return jsonOk({
      organisation: gated.ctx.organisation,
      membership: gated.ctx.membership,
      needsOnboarding: false,
    })
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : 'Failed to load organisation', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isPrivateTenderOrganisationWorkspaceEnabled()) {
      return jsonErr('Organisation workspace is not enabled', 404)
    }
    const auth = await verifyApiUserDetailed(request.headers.get('authorization'), [
      'sme',
      'admin',
    ])
    if (!auth.ok) {
      return responseFromVerifyFailure(auth) as unknown as NextResponse
    }

    const memberService = require('../../../../backend/services/privateOrganisationMemberService.js')
    const existing = await memberService.getActiveMembershipForUser(auth.user.uid)
    if (existing) {
      const orgService = require('../../../../backend/services/privateOrganisationService.js')
      const organisation = await orgService.getOrganisationById(existing.organisationId)
      return jsonOk({ organisation, membership: existing, created: false })
    }

    const body = await request.json()
    const orgService = require('../../../../backend/services/privateOrganisationService.js')
    const organisation = await orgService.createOrganisation(
      {
        legalName: body.legalName || body.companyName,
        tradingName: body.tradingName,
        registrationNumber: body.registrationNumber,
        website: body.website,
        organisationType: body.organisationType,
        industry: body.industry,
        address: body.address,
        primaryContactName: body.primaryContactName || auth.user.displayName || 'Procurement contact',
        primaryContactEmail: body.primaryContactEmail || auth.user.email,
        primaryContactPhone: body.primaryContactPhone,
      },
      { createdBy: auth.user.uid }
    )

    const membership = await memberService.createMembership(
      {
        organisationId: organisation.id,
        uid: auth.user.uid,
        email: auth.user.email,
        role: 'owner',
        status: 'active',
      },
      { invitedByUid: auth.user.uid }
    )

    return jsonOk({ organisation, membership, created: true }, 201)
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return jsonErr(error instanceof Error ? error.message : 'Failed to create organisation', status)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gated = await requireProcurementAccess(request, 'manage_profile')
    if ('response' in gated) return gated.response
    const body = await request.json()
    const orgService = require('../../../../backend/services/privateOrganisationService.js')
    const { verificationStatus: _v, status: _s, createdBy: _c, ...safe } = body || {}
    const organisation = await orgService.updateOrganisation(gated.ctx.organisation.id, safe, {
      allowVerificationWrite: false,
    })
    return jsonOk({ organisation })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return jsonErr(error instanceof Error ? error.message : 'Failed to update organisation', status)
  }
}
