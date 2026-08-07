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
import {
  createPlatformProfile,
  hasFullRegistrationPayload,
  logProfileSetupFailure,
} from '@/lib/auth/serverProfileBootstrap'
import type { UserProfile } from '@/lib/auth'
import { notifyUserRegisteredSafe } from '../../../../backend/services/founderOpsNotificationService'

export const dynamic = 'force-dynamic'

type Decoded = {
  uid: string
  email?: string
  name?: string
  picture?: string
  firebase?: { sign_in_provider?: string; identities?: Record<string, unknown> }
}

type BootstrapBody = {
  intendedRole?: string
  registrationJourney?: string
  displayName?: string
  additionalData?: Partial<UserProfile>
}

function providerIdsFromDecoded(decoded: Decoded): string[] {
  const identities = decoded.firebase?.identities || {}
  const ids = Object.keys(identities)
  if (ids.length) return ids
  if (decoded.firebase?.sign_in_provider) return [decoded.firebase.sign_in_provider]
  return ['password']
}

/**
 * Unified authenticated profile bootstrap (Google, email, or recovery).
 * - Never creates admin or founderAccess from client intent
 * - Never overwrites an existing userType
 * - Optional additionalData for full email registration payloads
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

  let body: BootstrapBody = {}
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

    const db = admin.firestore()
    const userRef = db.collection('users').doc(uid)
    const snap = await userRef.get()
    const now = new Date().toISOString()
    const providerIds = providerIdsFromDecoded(decoded)
    const email = (decoded.email || '').trim().toLowerCase()
    const displayName = (
      body.displayName ||
      decoded.name ||
      email.split('@')[0] ||
      'User'
    ).trim()
    const photoURL = typeof decoded.picture === 'string' ? decoded.picture : null
    const authProvider = providerIds.includes('google.com')
      ? 'google'
      : providerIds.includes('password')
        ? 'password'
        : providerIds[0] || 'password'

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

      const prevProviders = Array.isArray(existing.providerIds) ? existing.providerIds : []
      const mergedProviders = Array.from(new Set([...prevProviders, ...providerIds]))
      await userRef.set(
        {
          email: email || existing.email || '',
          displayName: existing.displayName || displayName,
          photoURL: photoURL || existing.photoURL || null,
          authenticationProvider: existing.authenticationProvider || authProvider,
          providerIds: mergedProviders,
          lastLoginAt: now,
          lastSeenAt: now,
          updatedAt: now,
        },
        { merge: true }
      )

      const profile = { ...existing, lastLoginAt: now, lastSeenAt: now, userType, uid }
      const dest = resolvePostAuthDestination(profile as never)
      return NextResponse.json({
        success: true,
        data: {
          created: false,
          userProfile: profile,
          profile: {
            uid,
            email: profile.email || email,
            displayName: profile.displayName || displayName,
            userType,
            onboardingCompleted: profile.onboardingCompleted === true,
            photoURL: profile.photoURL || photoURL,
            authenticationProvider: profile.authenticationProvider || authProvider,
          },
          onboardingRequired: dest.onboardingRequired,
          redirectPath: dest.path,
          blocked: dest.blocked,
          blockReason: dest.blockReason,
        },
      })
    }

    const resolved = resolveBootstrapRole({
      existingUserType: null,
      intendedRole: body.intendedRole,
    })
    if (resolved.rejectedAdminIntent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin cannot be assigned via self-registration.',
          code: 'ROLE_REJECTED',
        },
        { status: 403 }
      )
    }
    if (!resolved.role || !isGoogleBootstrapRole(resolved.role)) {
      return NextResponse.json({
        success: true,
        data: {
          created: false,
          needsRoleSelection: true,
          redirectPath: '/auth/role-selection?recover=1',
          onboardingRequired: true,
          profile: null,
          userProfile: null,
        },
      })
    }

    const role: GoogleBootstrapRole = resolved.role
    const onboardingCompleted = hasFullRegistrationPayload(role, body.additionalData)

    const userProfile = await createPlatformProfile(db, {
      uid,
      email,
      displayName,
      role,
      authenticationProvider: authProvider,
      providerIds,
      photoURL,
      additionalData: body.additionalData,
      onboardingCompleted,
    })

    // Founder/ops alert — fail-soft; never block registration
    try {
      await notifyUserRegisteredSafe(userProfile)
    } catch (founderNotifyErr) {
      console.warn(
        '[auth/bootstrap-profile] founder ops notify failed (non-blocking):',
        founderNotifyErr instanceof Error
          ? founderNotifyErr.message.slice(0, 160)
          : 'unknown'
      )
    }

    if (email && !onboardingCompleted) {
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

    const redirectPath = onboardingCompleted
      ? dashboardPathForRole(role)
      : onboardingPathForRole(role)

    return NextResponse.json({
      success: true,
      data: {
        created: true,
        firstGoogleRegistration: authProvider === 'google',
        userProfile,
        profile: {
          uid,
          email,
          displayName,
          userType: role,
          onboardingCompleted,
          photoURL,
          authenticationProvider: authProvider,
        },
        onboardingRequired: !onboardingCompleted,
        redirectPath,
        dashboardPath: dashboardPathForRole(role),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bootstrap failed'
    if (/disabled|USER_DISABLED/i.test(message)) {
      return NextResponse.json(
        {
          success: false,
          error: 'This account has been disabled. Contact support.',
          code: 'ACCOUNT_DISABLED',
        },
        { status: 403 }
      )
    }
    logProfileSetupFailure('bootstrap-profile', { message })
    return NextResponse.json(
      { success: false, error: 'Could not complete sign-in profile setup.' },
      { status: 500 }
    )
  }
}
