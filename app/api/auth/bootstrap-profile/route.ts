import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import {
  isGoogleBootstrapRole,
  isProfileSuspended,
  onboardingPathForRole,
  resolveBootstrapRole,
  resolvePostAuthDestination,
  type GoogleBootstrapRole,
} from '@/lib/auth/googleAuthFlow'
import { dashboardPathForRole } from '@/lib/auth/redirects'
import { sendWelcomeEmailSafe } from '@/lib/services/welcomeEmail'

export const dynamic = 'force-dynamic'

type Decoded = {
  uid: string
  email?: string
  name?: string
  picture?: string
  firebase?: { sign_in_provider?: string; identities?: Record<string, unknown> }
}

function providerIdsFromDecoded(decoded: Decoded): string[] {
  const identities = decoded.firebase?.identities || {}
  const ids = Object.keys(identities)
  if (ids.length) return ids
  if (decoded.firebase?.sign_in_provider) return [decoded.firebase.sign_in_provider]
  return ['google.com']
}

/**
 * Authenticated profile bootstrap after Google (or any) sign-in.
 * - Never creates admin or founderAccess from client intent
 * - Never overwrites an existing userType
 * - First-time Google users get onboardingCompleted: false
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7).trim()
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { intendedRole?: string; registrationJourney?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    const admin = getFirebaseAdmin()
    const decoded = (await admin.auth().verifyIdToken(token)) as Decoded
    const uid = decoded.uid
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Firebase Auth disabled users fail verifyIdToken; still check Firestore suspension.
    const db = admin.firestore()
    const userRef = db.collection('users').doc(uid)
    const snap = await userRef.get()
    const now = new Date().toISOString()
    const providerIds = providerIdsFromDecoded(decoded)
    const email = (decoded.email || '').trim().toLowerCase()
    const displayName = (decoded.name || email.split('@')[0] || 'User').trim()
    const photoURL = typeof decoded.picture === 'string' ? decoded.picture : null

    if (snap.exists) {
      const existing = snap.data() || {}
      if (isProfileSuspended(existing as never)) {
        return NextResponse.json(
          {
            success: false,
            error: 'This account is suspended. Contact support.',
            code: 'ACCOUNT_SUSPENDED',
          },
          { status: 403 }
        )
      }

      const userType = existing.userType as 'sme' | 'youth-agent' | 'admin'
      if (!['sme', 'youth-agent', 'admin'].includes(userType)) {
        return NextResponse.json(
          { success: false, error: 'Profile is missing a valid role. Contact support.' },
          { status: 400 }
        )
      }

      // Touch login metadata only — never privileged fields.
      const prevProviders = Array.isArray(existing.providerIds) ? existing.providerIds : []
      const mergedProviders = Array.from(new Set([...prevProviders, ...providerIds]))
      await userRef.set(
        {
          email: email || existing.email || '',
          displayName: existing.displayName || displayName,
          photoURL: photoURL || existing.photoURL || null,
          authenticationProvider: existing.authenticationProvider || 'google',
          providerIds: mergedProviders,
          lastLoginAt: now,
          lastSeenAt: now,
          updatedAt: now,
        },
        { merge: true }
      )

      const profile = { ...existing, ...{ lastLoginAt: now, lastSeenAt: now, userType }, uid }
      const dest = resolvePostAuthDestination(profile as never)
      return NextResponse.json({
        success: true,
        data: {
          created: false,
          profile: {
            uid,
            email: profile.email || email,
            displayName: profile.displayName || displayName,
            userType,
            onboardingCompleted: profile.onboardingCompleted === true,
            photoURL: profile.photoURL || photoURL,
            authenticationProvider: profile.authenticationProvider || 'google',
          },
          onboardingRequired: dest.onboardingRequired,
          redirectPath: dest.path,
          blocked: dest.blocked,
          blockReason: dest.blockReason,
        },
      })
    }

    // First-time profile — require explicit SME or Youth Agent journey.
    const resolved = resolveBootstrapRole({
      existingUserType: null,
      intendedRole: body.intendedRole,
    })
    if (resolved.rejectedAdminIntent) {
      return NextResponse.json(
        { success: false, error: 'Admin cannot be assigned via Google Sign-In.', code: 'ROLE_REJECTED' },
        { status: 403 }
      )
    }
    if (!resolved.role || !isGoogleBootstrapRole(resolved.role)) {
      return NextResponse.json({
        success: true,
        data: {
          created: false,
          needsRoleSelection: true,
          redirectPath: '/auth/role-selection?google=1',
          onboardingRequired: true,
          profile: null,
        },
      })
    }

    const role: GoogleBootstrapRole = resolved.role
    const profile = {
      uid,
      email,
      displayName,
      photoURL,
      userType: role,
      authenticationProvider: 'google',
      providerIds,
      onboardingCompleted: false,
      founderAccess: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      lastSeenAt: now,
      ...(role === 'youth-agent'
        ? {
            verificationStatus: 'pending',
            reliabilityScore: 100,
            missedBriefingCount: 0,
            completedBriefingCount: 0,
            acceptedBriefingCount: 0,
            rating: 3,
          }
        : {}),
    }

    await userRef.set(profile)

    if (role === 'sme') {
      await db.collection('smes').doc(uid).set(
        {
          id: uid,
          uid,
          email,
          displayName,
          companyName: '',
          contactPerson: displayName,
          userType: 'sme',
          onboardingCompleted: false,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      )
    } else {
      await db.collection('agents').doc(uid).set(
        {
          id: uid,
          uid,
          email,
          displayName,
          name: displayName,
          userType: 'youth-agent',
          verificationStatus: 'pending',
          verified: false,
          onboardingCompleted: false,
          reliabilityScore: 100,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      )
    }

    // Touch summary registration fields (Admin SDK only collection)
    await db
      .collection('userActivitySummaries')
      .doc(uid)
      .set(
        {
          uid,
          actorRole: role,
          authenticationProvider: 'google',
          registrationDate: now,
          firstSeenAt: now,
          lastLoginAt: now,
          lastSeenAt: now,
          updatedAt: now,
        },
        { merge: true }
      )

    // First-time Google registration only — never on subsequent logins.
    // Mail failures must not block profile creation.
    if (email) {
      try {
        const welcome = await sendWelcomeEmailSafe({
          to: email,
          displayName,
          userType: role,
        })
        if (welcome.sent) {
          await userRef.set({ welcomeEmailSentAt: now, updatedAt: now }, { merge: true })
        }
      } catch (welcomeErr) {
        console.warn('[auth/bootstrap-profile] welcome email failed (non-blocking):', welcomeErr)
      }
    }

    const redirectPath = onboardingPathForRole(role)
    return NextResponse.json({
      success: true,
      data: {
        created: true,
        firstGoogleRegistration: true,
        profile: {
          uid,
          email,
          displayName,
          userType: role,
          onboardingCompleted: false,
          photoURL,
          authenticationProvider: 'google',
        },
        onboardingRequired: true,
        redirectPath,
        dashboardPath: dashboardPathForRole(role),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bootstrap failed'
    // Disabled Firebase users surface as auth errors from verifyIdToken
    if (/disabled|USER_DISABLED/i.test(message)) {
      return NextResponse.json(
        { success: false, error: 'This account has been disabled. Contact support.', code: 'ACCOUNT_DISABLED' },
        { status: 403 }
      )
    }
    console.error('[auth/bootstrap-profile]', message)
    return NextResponse.json({ success: false, error: 'Could not complete sign-in profile setup.' }, { status: 500 })
  }
}
