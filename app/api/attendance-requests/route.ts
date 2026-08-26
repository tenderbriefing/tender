import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'
import {
  enforceDistributedPolicy,
  tooManyRequests,
} from '@/lib/security/distributedRateLimit'
import { logEvent, newRequestId } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const storage = backend.getStorage()
    const agentService = backend.agentAssignment()

    let requests

    if (user.userType === 'admin') {
      requests = await storage.getAttendanceRequests({
        smeId: searchParams.get('smeId') || undefined,
        agentId: searchParams.get('agentId') || undefined,
        status: searchParams.get('status') || undefined,
        availableForAgent: searchParams.get('availableForAgent') || undefined,
      })
    } else if (user.userType === 'sme') {
      requests = await storage.getAttendanceRequests({ smeId: user.uid })
      const status = searchParams.get('status')
      if (status) requests = requests.filter((r) => r.status === status)
    } else if (user.userType === 'youth-agent') {
      if (searchParams.get('opportunities') === 'true') {
        requests = await agentService.listOpportunitiesForAgent(
          user.uid,
          user.province || ''
        )
      } else {
        requests = await storage.getAttendanceRequests({ agentId: user.uid })
      }
    } else {
      return forbiddenResponse()
    }

    const paymentStatus = searchParams.get('paymentStatus')
    if (paymentStatus) {
      requests = requests.filter((r) => r.paymentStatus === paymentStatus)
    }

    const { enrichAttendanceRequests } = await import('@/lib/backend/enrichAttendanceRequests')
    const enriched = await enrichAttendanceRequests(requests)

    return NextResponse.json({ success: true, data: enriched })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load requests',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const requestId = newRequestId()
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['sme'])
    if (!user) return unauthorizedResponse('SME sign-in required')

    const limited = await enforceDistributedPolicy('attendance-create', user.uid)
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSec)

    const body = await request.json()
    const agentService = backend.agentAssignment()
    const storage = backend.getStorage()
    const users = backend.users()

    const tender = body.tenderId
      ? await storage.getTenderBriefingById(body.tenderId)
      : null

    if (body.tenderId && !tender) {
      return NextResponse.json(
        { success: false, error: 'Tender briefing not found' },
        { status: 404 }
      )
    }

    // Phase 3A: physical briefing booking enrichment is flag-gated; public bookings remain available.
    const { isPrivateTenderBriefingBookingEnabled } = await import(
      '@/lib/privateTenders/briefingOpsFlags'
    )
    const { isPhysicalBriefingBookable } = await import('@/lib/privateTenders/briefingFields')
    const { buildPrivateTenderBookingSnapshot } = await import(
      '@/lib/privateTenders/privateBookingSnapshot'
    )
    const bookingSnapshot = buildPrivateTenderBookingSnapshot(
      tender as unknown as Record<string, unknown>
    )
    if (
      isPrivateTenderBriefingBookingEnabled() &&
      bookingSnapshot.source === 'private_tender' &&
      tender &&
      !isPhysicalBriefingBookable(tender as unknown as Record<string, unknown>)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Youth Agent booking applies to physical compulsory briefings. This private tender does not have a bookable physical briefing.',
          code: 'BRIEFING_NOT_PHYSICAL',
        },
        { status: 400 }
      )
    }

    if (tender?.visibility === 'private') {
      const { smeHasPrivateBookAccess } = await import(
        '@/lib/security/privateTenderInvite'
      )
      const invite =
        typeof body.invite === 'string'
          ? body.invite
          : request.headers.get('x-private-invite')
      if (
        !smeHasPrivateBookAccess({
          tender,
          smeUid: user.uid,
          inviteToken: invite,
        })
      ) {
        return forbiddenResponse(
          'This private RFQ is not accessible — use a valid payment invite link'
        )
      }
    }

    const agents = await users.getYouthAgents()

    await users.upsertSmeProfile({
      id: user.uid,
      displayName: user.displayName,
      companyName: user.companyName || body.smeCompany,
      email: user.email,
    })

    const result = await agentService.createRequest(
      {
        tenderId: body.tenderId,
        tenderNumber: tender?.tenderNumber || bookingSnapshot.tenderNumber,
        tenderTitle: tender?.title || body.tenderTitle || bookingSnapshot.tenderTitle,
        department: tender?.department,
        smeId: user.uid,
        smeName: user.displayName || body.smeName,
        smeCompany: user.companyName || body.smeCompany,
        smeEmail: user.email,
        smePhone: body.smePhone,
        province: tender?.province || body.province || bookingSnapshot.briefingSnapshot?.briefingProvince,
        briefingVenue: tender?.briefingVenue || body.briefingVenue || bookingSnapshot.briefingSnapshot?.briefingVenue,
        briefingDate: tender?.briefingDate || body.briefingDate || bookingSnapshot.briefingSnapshot?.briefingDate,
        briefingTime:
          tender?.briefingTime ||
          body.briefingTime ||
          bookingSnapshot.briefingSnapshot?.briefingStartTime,
        notes: body.notes,
        responsibilityAcknowledged: body.responsibilityAcknowledged === true,
        latitude: body.latitude,
        longitude: body.longitude,
        radiusKm: body.radiusKm,
        // Phase 3A immutable private-tender linkage + pricing snapshot
        source: bookingSnapshot.source,
        privateTenderId: bookingSnapshot.privateTenderId,
        privateSubmissionId: bookingSnapshot.privateSubmissionId,
        organisationId: bookingSnapshot.organisationId,
        briefingSnapshot: bookingSnapshot.briefingSnapshot,
        briefingPriceCents: bookingSnapshot.briefingPriceCents,
        paymentAmount: bookingSnapshot.paymentAmount,
        quotedFee: bookingSnapshot.quotedFee,
        currency: bookingSnapshot.currency,
        pricingVersion: bookingSnapshot.pricingVersion,
      },
      agents
    )

    // Durable product + private audit events (fail-soft)
    try {
      if (bookingSnapshot.source === 'private_tender' && isPrivateTenderBriefingBookingEnabled()) {
        const events = require('../../../backend/services/productEventService.js')
        if (typeof events.ingestProductEvent === 'function') {
          await events.ingestProductEvent({
            name: 'private_tender_briefing_booked',
            uid: user.uid,
            metadata: {
              attendanceRequestId: result.request.id,
              privateTenderId: bookingSnapshot.privateTenderId,
              privateSubmissionId: bookingSnapshot.privateSubmissionId,
            },
          })
        }
        const { writeAuditEvent } = require('../../../backend/services/privateTenderAuditService.js')
        await writeAuditEvent({
          submissionId: bookingSnapshot.privateSubmissionId || bookingSnapshot.privateTenderId,
          organisationId: bookingSnapshot.organisationId,
          actorUid: user.uid,
          actorType: 'sme',
          eventType: 'private_tender_briefing_booking_created',
          metadata: {
            attendanceRequestId: result.request.id,
            briefingPriceCents: bookingSnapshot.briefingPriceCents,
            pricingVersion: bookingSnapshot.pricingVersion,
          },
        })
      }
    } catch {
      /* fail-soft */
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://www.tenderbriefing.co.za'

    const paymentService = require('../../../backend/services/payments/attendancePaymentService')
    const checkout = await paymentService.createCheckoutForExistingRequest(
      result.request.id,
      user.uid,
      origin
    )

    if (!checkout.ok) {
      const code =
        checkout.configured === false ? 'PAYFAST_NOT_CONFIGURED' : 'CHECKOUT_FAILED'
      const payment = {
        required: true,
        configured: checkout.configured !== false,
        code,
        message: checkout.error || 'PayFast is not configured',
      }
      logEvent({
        event: 'attendance_request_created',
        requestId,
        userId: user.uid,
        role: 'sme',
        attendanceRequestId: result.request.id,
        tenderId: body.tenderId || undefined,
        outcome: code === 'PAYFAST_NOT_CONFIGURED' ? 'success' : 'failure',
        errorCode: code,
        severity: code === 'PAYFAST_NOT_CONFIGURED' ? 'warn' : 'error',
      })
      // Request is saved; return success so SME can view pending payment + retry
      if (code === 'PAYFAST_NOT_CONFIGURED') {
        return NextResponse.json({
          success: true,
          data: {
            request: result.request,
            nearbyAgents: [],
            resumed: Boolean(result.resumed),
            resumeUrl: `/sme/requests/${result.request.id}`,
            payment,
          },
        })
      }
      return NextResponse.json(
        {
          success: false,
          error: checkout.error || 'Payment checkout failed',
          code,
          data: {
            request: result.request,
            resumed: Boolean(result.resumed),
            resumeUrl: `/sme/requests/${result.request.id}`,
            payment,
          },
        },
        { status: 400 }
      )
    }

    logEvent({
      event: 'attendance_request_created',
      requestId,
      userId: user.uid,
      role: 'sme',
      attendanceRequestId: checkout.request.id,
      tenderId: body.tenderId || undefined,
      outcome: 'success',
    })

    return NextResponse.json({
      success: true,
      data: {
        request: checkout.request,
        nearbyAgents: [],
        resumed: Boolean(result.resumed),
        resumeUrl: `/sme/requests/${checkout.request.id}`,
        payment: {
          required: true,
          formAction: checkout.formAction,
          fields: checkout.fields,
          redirectUrl: checkout.redirectUrl,
          checkoutId: checkout.checkoutId,
          amountCents: paymentService.ATTENDANCE_FEE_CENTS,
          currency: 'ZAR',
          provider: 'payfast',
        },
      },
    })
  } catch (error) {
    const err = error as {
      code?: string
      message?: string
      existingRequest?: { id?: string; paymentStatus?: string }
    }
    if (err?.code === 'ACTIVE_REQUEST_EXISTS' && err.existingRequest?.id) {
      logEvent({
        event: 'attendance_request_created',
        requestId,
        outcome: 'denied',
        errorCode: 'ACTIVE_REQUEST_EXISTS',
        attendanceRequestId: err.existingRequest.id,
      })
      return NextResponse.json(
        {
          success: false,
          code: 'ACTIVE_REQUEST_EXISTS',
          error:
            'You already have an active booking for this tender. Open your request to view status.',
          data: {
            request: err.existingRequest,
            resumeUrl: `/sme/requests/${err.existingRequest.id}`,
            paymentStatus: err.existingRequest.paymentStatus || null,
          },
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create request',
      },
      { status: 400 }
    )
  }
}
