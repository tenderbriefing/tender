import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

/**
 * Youth Agent banking profile — own profile only via server API.
 * Full account number is never returned on GET (masked only).
 */
export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
  if (!user) return unauthorizedResponse('Youth Agent sign-in required')

  try {
    const svc = require('../../../../backend/services/finance/youthAgentBankingService.js')
    const profile = await svc.getBankingProfile(user.uid)
    return NextResponse.json({
      success: true,
      data: profile ? svc.toPublic(profile) : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load banking profile',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
  if (!user) return unauthorizedResponse('Youth Agent sign-in required')

  try {
    const body = await request.json().catch(() => ({}))
    // Reject attempts to write another agent's profile via body spoofing.
    if (body.youthAgentUid && body.youthAgentUid !== user.uid) {
      return forbiddenResponse('Cannot update another agent banking profile')
    }

    const svc = require('../../../../backend/services/finance/youthAgentBankingService.js')
    const result = await svc.upsertBankingProfile(user.uid, body, { actorUid: user.uid })
    return NextResponse.json({
      success: true,
      data: svc.toPublic(result.profile),
      created: result.created,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to save banking profile'
    const status = /required|must be|digits/i.test(msg) ? 400 : 500
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
