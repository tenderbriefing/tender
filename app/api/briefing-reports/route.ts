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
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId is required' },
        { status: 400 }
      )
    }

    const agentService = backend.agentAssignment()
    const attendance = await agentService.getRequestById(requestId)
    if (!attendance) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }

    const canView =
      user.userType === 'admin' ||
      attendance.smeId === user.uid ||
      attendance.assignedAgentId === user.uid ||
      attendance.agentId === user.uid

    if (!canView) return forbiddenResponse()

    const reports = await storage.getBriefingReports({ requestId })
    return NextResponse.json({ success: true, data: reports })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load reports',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
    if (!user) return unauthorizedResponse('Youth Agent sign-in required')

    const body = await request.json()
    const agentService = backend.agentAssignment()

    const attendance = await agentService.getRequestById(body.requestId)
    if (!attendance) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }

    if (
      attendance.assignedAgentId !== user.uid &&
      attendance.agentId !== user.uid
    ) {
      return forbiddenResponse('You are not assigned to this briefing')
    }

    const documentUrls = [
      ...(body.documentUrls || []),
      body.attendanceProofUrl,
      body.audioUrl,
    ].filter(Boolean)

    const report = await agentService.submitBriefingReport({
      requestId: body.requestId,
      agentId: user.uid,
      tenderId: body.tenderId || attendance.tenderId,
      summary: body.summary,
      notes: body.notes,
      attendanceProofUrl: body.attendanceProofUrl,
      audioUrl: body.audioUrl,
      documentUrls,
      photoUrls: body.photoUrls || [],
      attendanceConfirmed: body.attendanceConfirmed === true,
      arrivalTime: body.arrivalTime,
      briefingStartedTime: body.briefingStartedTime,
      keyInstructions: body.keyInstructions,
      submissionRequirements: body.submissionRequirements,
      documentsCollected: body.documentsCollected,
      questionsAsked: body.questionsAsked,
      risksClarifications: body.risksClarifications,
    })

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit report',
      },
      { status: 400 }
    )
  }
}
