import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import {
  isWelcomeEmailRole,
  sendWelcomeEmailSafe,
} from '@/lib/services/welcomeEmail'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/welcome-email
 * Sends a one-time welcome email after SME / Youth Agent registration.
 * Requires Bearer auth. Failures never block the client registration UX.
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
    if (!isWelcomeEmailRole(user.userType)) {
      return NextResponse.json(
        { success: false, error: 'Welcome emails are only for SME and Youth Agent accounts.' },
        { status: 400 }
      )
    }

    const admin = getFirebaseAdmin()
    const userRef = admin.firestore().collection('users').doc(user.uid)
    const snap = await userRef.get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    const data = snap.data() || {}
    if (data.welcomeEmailSentAt) {
      return NextResponse.json({
        success: true,
        data: { sent: false, skipped: true, reason: 'already_sent' },
      })
    }

    const email = (user.email || data.email || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'No email on account' },
        { status: 400 }
      )
    }

    const result = await sendWelcomeEmailSafe({
      to: email,
      uid: user.uid,
      displayName: String(data.displayName || user.displayName || ''),
      userType: user.userType,
      companyName: typeof data.companyName === 'string' ? data.companyName : user.companyName,
    })

    if (result.sent) {
      await userRef.set(
        { welcomeEmailSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { merge: true }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: result.sent,
        skipped: result.skipped === true,
        id: result.id,
        ...(result.error && !result.sent ? { warning: result.error } : {}),
      },
    })
  } catch (error) {
    console.error('[auth/welcome-email]', error)
    // Soft-fail so clients can ignore mail issues after successful signup.
    return NextResponse.json({
      success: true,
      data: {
        sent: false,
        skipped: true,
        warning: error instanceof Error ? error.message : 'Welcome email failed',
      },
    })
  }
}
