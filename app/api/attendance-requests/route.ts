import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'

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
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['sme'])
    if (!user) return unauthorizedResponse('SME sign-in required')

    const body = await request.json()
    const agentService = backend.agentAssignment()
    const storage = backend.getStorage()
    const users = backend.users()

    const tender = body.tenderId
      ? await storage.getTenderBriefingById(body.tenderId)
      : null

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
        tenderNumber: tender?.tenderNumber,
        tenderTitle: tender?.title || body.tenderTitle,
        department: tender?.department,
        smeId: user.uid,
        smeName: user.displayName || body.smeName,
        smeCompany: user.companyName || body.smeCompany,
        smeEmail: user.email,
        smePhone: body.smePhone,
        province: tender?.province || body.province,
        briefingVenue: tender?.briefingVenue || body.briefingVenue,
        briefingDate: tender?.briefingDate || body.briefingDate,
        briefingTime: tender?.briefingTime || body.briefingTime,
        notes: body.notes,
        responsibilityAcknowledged: body.responsibilityAcknowledged === true,
        latitude: body.latitude,
        longitude: body.longitude,
        radiusKm: body.radiusKm,
        paymentStatus: 'not_required',
        paymentProvider: 'none',
        currency: 'ZAR',
      },
      agents
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create request',
      },
      { status: 400 }
    )
  }
}
