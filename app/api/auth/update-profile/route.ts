import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import { stripPrivilegedFields } from '@/lib/auth/googleAuthFlow'
import { buildMatchingKeywords } from '@/lib/data/csdProcurementCatalog'
import { logProfileSetupFailure, nowIso } from '@/lib/auth/serverProfileBootstrap'
import { logEvent, newRequestId } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

type ProfileUpdateBody = {
  displayName?: string
  companyName?: string
  phoneNumber?: string
  location?: string
  skills?: string[]
  categories?: string[]
  commodities?: string[]
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50)
}

/**
 * Authenticated profile update via Admin SDK.
 * Allowlists non-privileged fields only — never accepts role/rating/verification.
 */
export async function PATCH(request: NextRequest) {
  const requestId = newRequestId()
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), [
      'sme',
      'youth-agent',
      'admin',
    ])
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let body: ProfileUpdateBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const displayName = String(body.displayName || '').trim()
    const companyName = String(body.companyName || '').trim()
    const phoneNumber = String(body.phoneNumber || '').trim()
    const location = String(body.location || '').trim()
    const skills = asStringArray(body.skills)
    const categories = asStringArray(body.categories)
    const commodities = asStringArray(body.commodities)

    if (!displayName) {
      return NextResponse.json(
        { success: false, error: 'Display name is required.' },
        { status: 400 }
      )
    }
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required.' },
        { status: 400 }
      )
    }
    if (!location) {
      return NextResponse.json(
        { success: false, error: 'Location is required.' },
        { status: 400 }
      )
    }
    if (user.userType === 'sme' && !companyName) {
      return NextResponse.json(
        { success: false, error: 'Company name is required.' },
        { status: 400 }
      )
    }
    if (user.userType === 'sme' && categories.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one category.' },
        { status: 400 }
      )
    }
    if (user.userType === 'youth-agent' && skills.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please add at least one skill.' },
        { status: 400 }
      )
    }

    const admin = getFirebaseAdmin()
    const db = admin.firestore()
    const uid = user.uid
    const timestamp = nowIso()
    const userRef = db.collection('users').doc(uid)

    const basePatch = stripPrivilegedFields({
      displayName,
      phoneNumber,
      whatsAppNumber: phoneNumber,
      location,
      updatedAt: timestamp,
    })

    if (user.userType === 'sme') {
      const matchingKeywords = buildMatchingKeywords(categories, commodities)
      const smePatch = stripPrivilegedFields({
        ...basePatch,
        companyName,
        categories,
        commodities,
        matchingKeywords,
        sectors: categories,
      })
      await userRef.set(smePatch, { merge: true })
      await db.collection('smes').doc(uid).set(
        {
          id: uid,
          uid,
          ...smePatch,
          userType: 'sme',
        },
        { merge: true }
      )
    } else if (user.userType === 'youth-agent') {
      const agentPatch = stripPrivilegedFields({
        ...basePatch,
        skills,
      })
      await userRef.set(agentPatch, { merge: true })
      await db.collection('agents').doc(uid).set(
        {
          id: uid,
          uid,
          name: displayName,
          ...agentPatch,
          userType: 'youth-agent',
        },
        { merge: true }
      )
    } else {
      await userRef.set(basePatch, { merge: true })
    }

    logEvent({
      event: 'profile_updated',
      requestId,
      userId: uid,
      role: user.userType,
      outcome: 'success',
    })

    return NextResponse.json({
      success: true,
      data: {
        displayName,
        companyName: user.userType === 'sme' ? companyName : undefined,
        phoneNumber,
        location,
        skills: user.userType === 'youth-agent' ? skills : undefined,
        categories: user.userType === 'sme' ? categories : undefined,
        commodities: user.userType === 'sme' ? commodities : undefined,
        updatedAt: timestamp,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile update failed'
    logProfileSetupFailure('update-profile', { message })
    logEvent({
      event: 'profile_updated',
      requestId,
      outcome: 'failure',
      severity: 'error',
      errorCode: 'PROFILE_UPDATE_FAILED',
    })
    return NextResponse.json(
      { success: false, error: 'Could not update profile. Please try again.' },
      { status: 500 }
    )
  }
}
