import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'
import {
  canAccessProcurementIntelligence,
  isProcurementIntelligenceEnabled,
  parseProcurementIntelligencePilotUids,
} from '@/lib/procurement/intelligence/featureFlag'
import { buildProcurementIntelligence } from '@/lib/procurement/intelligence/buildIntelligence'
import { logEvent, newRequestId } from '@/lib/observability/logger'
import type { SmeProfileInput } from '@/lib/procurement/intelligence/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { tenderId: string } }
) {
  const requestId = newRequestId()

  const user = await verifyApiUser(request.headers.get('authorization'), [
    'sme',
    'admin',
  ])
  if (!user) return unauthorizedResponse('Sign-in required')

  if (!canAccessProcurementIntelligence({ uid: user.uid, userType: user.userType })) {
    const pilotsConfigured = parseProcurementIntelligencePilotUids().length > 0
    if (!isProcurementIntelligenceEnabled() && !pilotsConfigured) {
      return NextResponse.json(
        {
          error: {
            code: 'feature_disabled',
            message: 'Procurement Intelligence is not enabled',
            requestId,
          },
        },
        { status: 503 }
      )
    }
    return forbiddenResponse('Pilot access required')
  }

  const tenderId = params.tenderId
  if (!tenderId || tenderId.length > 200) {
    return NextResponse.json(
      { error: { code: 'invalid_tender', message: 'Invalid tender id', requestId } },
      { status: 400 }
    )
  }

  try {
    const { getStorage } = require('../../../../../backend/services/storageAdapter')
    const storage = getStorage()
    const tender = await storage.getTenderBriefingById(tenderId)
    if (!tender) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Tender not found', requestId } },
        { status: 404 }
      )
    }

    let sme: SmeProfileInput = { uid: user.uid }
    if (user.userType === 'sme') {
      try {
        const { getFirebaseAdmin } = require('@/lib/backend/firebaseAdmin')
        const snap = await getFirebaseAdmin()
          .firestore()
          .collection('users')
          .doc(user.uid)
          .get()
        if (snap.exists) {
          const d = snap.data() || {}
          sme = {
            uid: user.uid,
            province: d.province || d.location || user.province,
            categories: d.categories || [],
            sectors: d.sectors || [],
            commodities: d.commodities || [],
            matchingKeywords: d.matchingKeywords || [],
            csdRegistered: d.csdRegistered,
            cidbGrade: d.cidbGrade,
            bbbeeLevel: d.bbbeeLevel,
            taxClearanceValid: d.taxClearanceValid,
            coidaCompliant: d.coidaCompliant,
            compliance: d.compliance,
          }
        }
      } catch {
        /* profile optional */
      }
    }

    const intelligence = buildProcurementIntelligence(tender, sme)

    logEvent({
      event: 'intelligence_completed',
      requestId,
      userId: user.uid,
      role: user.userType,
      tenderId,
      outcome: 'success',
      errorCode: intelligence.status,
    })

    return NextResponse.json({
      success: true,
      data: intelligence,
      requestId,
    })
  } catch (error) {
    logEvent({
      event: 'extraction_failed',
      severity: 'error',
      requestId,
      userId: user.uid,
      tenderId,
      outcome: 'failure',
      errorCode: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json(
      {
        error: {
          code: 'intelligence_failed',
          message: 'Unable to build tender intelligence',
          requestId,
        },
      },
      { status: 500 }
    )
  }
}
