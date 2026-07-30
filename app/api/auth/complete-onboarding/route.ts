import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import { stripPrivilegedFields } from '@/lib/auth/googleAuthFlow'
import { buildMatchingKeywords } from '@/lib/data/csdProcurementCatalog'
import { logProfileSetupFailure, nowIso } from '@/lib/auth/serverProfileBootstrap'
import type { AgentOnboardingInput, SmeOnboardingInput } from '@/lib/onboarding/client'

export const dynamic = 'force-dynamic'

type OnboardingBody =
  | { journey: 'sme'; input: SmeOnboardingInput }
  | { journey: 'youth-agent'; input: AgentOnboardingInput }

/**
 * Completes SME / Youth Agent onboarding via Admin SDK (avoids client rules fragility).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), [
      'sme',
      'youth-agent',
    ])
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let body: OnboardingBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    if (body.journey !== user.userType) {
      return NextResponse.json(
        { success: false, error: 'Onboarding journey does not match your account role.' },
        { status: 403 }
      )
    }

    const admin = getFirebaseAdmin()
    const db = admin.firestore()
    const uid = user.uid
    const email = (user.email || '').trim().toLowerCase()
    const timestamp = nowIso()
    const userRef = db.collection('users').doc(uid)
    const snap = await userRef.get()
    const existing = snap.data() || {}

    if (body.journey === 'sme') {
      const input = body.input
      if (!input?.companyName?.trim() || !input.province || !input.categories?.length) {
        return NextResponse.json(
          { success: false, error: 'Company name, province, and categories are required.' },
          { status: 400 }
        )
      }
      const matchingKeywords = buildMatchingKeywords(input.categories, input.commodities || [])
      const profilePatch = stripPrivilegedFields({
        email,
        displayName: existing.displayName || input.companyName.trim(),
        companyName: input.companyName.trim(),
        csdNumber: (input.csdNumber || '').trim(),
        province: input.province,
        categories: input.categories,
        commodities: input.commodities || [],
        matchingKeywords,
        sectors: input.categories,
        provincesOfInterest: [input.province],
        phoneNumber: (input.whatsAppNumber || '').trim(),
        whatsAppNumber: (input.whatsAppNumber || '').trim(),
        preferredDepartments: input.preferredDepartments || [],
        tenderInterests: (input.tenderInterests || '').trim(),
        onboardingCompleted: true,
        onboardingCompletedAt: timestamp,
        updatedAt: timestamp,
      })

      await userRef.set(profilePatch, { merge: true })
      await db.collection('smes').doc(uid).set(
        {
          id: uid,
          uid,
          email,
          displayName: existing.displayName || input.companyName.trim(),
          companyName: input.companyName.trim(),
          contactPerson: existing.displayName || '',
          csdNumber: (input.csdNumber || '').trim(),
          province: input.province,
          categories: input.categories,
          commodities: input.commodities || [],
          matchingKeywords,
          sectors: input.categories,
          preferredDepartments: input.preferredDepartments || [],
          tenderInterests: (input.tenderInterests || '').trim(),
          phoneNumber: (input.whatsAppNumber || '').trim(),
          whatsAppNumber: (input.whatsAppNumber || '').trim(),
          provincesOfInterest: [input.province],
          userType: 'sme',
          onboardingCompleted: true,
          onboardingCompletedAt: timestamp,
          updatedAt: timestamp,
        },
        { merge: true }
      )
    } else {
      const input = body.input
      if (!input?.displayName?.trim() || !input.province || !input.city?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Name, province, and city are required.' },
          { status: 400 }
        )
      }
      if (!input.codeOfConductAccepted) {
        return NextResponse.json(
          { success: false, error: 'Code of conduct must be accepted.' },
          { status: 400 }
        )
      }
      const preferredServiceAreas =
        input.preferredServiceAreas?.length > 0
          ? input.preferredServiceAreas
          : [input.province]
      const profilePatch = stripPrivilegedFields({
        email,
        displayName: input.displayName.trim(),
        province: input.province,
        city: input.city.trim(),
        location: `${input.city.trim()}, ${input.province}`,
        phoneNumber: (input.whatsAppNumber || '').trim(),
        whatsAppNumber: (input.whatsAppNumber || '').trim(),
        transportAvailable: input.transportAvailable !== false,
        preferredServiceAreas,
        idVerificationNote: (input.idVerificationNote || '').trim(),
        codeOfConductAccepted: true,
        codeOfConductAcceptedAt: timestamp,
        onboardingCompleted: true,
        onboardingCompletedAt: timestamp,
        updatedAt: timestamp,
      })

      await userRef.set(profilePatch, { merge: true })
      await db.collection('agents').doc(uid).set(
        {
          id: uid,
          uid,
          email,
          displayName: input.displayName.trim(),
          name: input.displayName.trim(),
          province: input.province,
          city: input.city.trim(),
          location: `${input.city.trim()}, ${input.province}`,
          phoneNumber: (input.whatsAppNumber || '').trim(),
          whatsAppNumber: (input.whatsAppNumber || '').trim(),
          transportAvailable: input.transportAvailable !== false,
          preferredServiceAreas,
          idVerificationNote: (input.idVerificationNote || '').trim(),
          codeOfConductAccepted: true,
          verificationStatus: existing.verificationStatus || 'pending',
          userType: 'youth-agent',
          onboardingCompleted: true,
          onboardingCompletedAt: timestamp,
          updatedAt: timestamp,
        },
        { merge: true }
      )
    }

    return NextResponse.json({ success: true, data: { onboardingCompleted: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onboarding failed'
    logProfileSetupFailure('complete-onboarding', { message })
    return NextResponse.json(
      { success: false, error: 'Could not save onboarding. Please try again.' },
      { status: 500 }
    )
  }
}
