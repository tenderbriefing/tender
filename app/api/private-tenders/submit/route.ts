import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'
import { validatePrivateTenderSubmission } from '@/lib/privateTenders/validation'
import {
  isAllowedTenderDocument,
  MAX_TENDER_DOCUMENT_BYTES,
} from '@/lib/privateTenders/constants'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request)
    const limited = checkRateLimit(`private-tender-submit:${ip}`, 5, 60 * 60 * 1000)
    if (!limited.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many submissions — please try again later' },
        {
          status: 429,
          headers: limited.retryAfterSec
            ? { 'Retry-After': String(limited.retryAfterSec) }
            : undefined,
        }
      )
    }

    const body = await request.json()
    const user = await verifyApiUser(request.headers.get('authorization'))

    const validated = validatePrivateTenderSubmission(body)
    if (!validated.ok) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', issues: validated.issues },
        { status: 400 }
      )
    }

    const doc = validated.value.tenderDocument
    if (
      !isAllowedTenderDocument(doc.fileName, doc.contentType) ||
      doc.sizeBytes > MAX_TENDER_DOCUMENT_BYTES
    ) {
      return NextResponse.json(
        { success: false, error: 'Unsafe or oversized tender document' },
        { status: 400 }
      )
    }

    const svc = require('../../../../backend/services/privateTenderSubmissionService.js')
    const submission = await svc.createSubmission(validated.value, {
      submittedByUid: user?.uid || null,
      submittedByEmail: user?.email || validated.value.contactEmail,
      ip,
    })

    // Fail-soft acknowledgement email
    try {
      const emailSvc = require('../../../../lib/services/privateTenderEmail.js')
      await emailSvc.sendPrivateTenderSubmittedAck({
        to: submission.contactEmail,
        companyName: submission.companyName,
        title: submission.title,
        tenderReference: submission.tenderReference,
        trackingToken: submission.trackingToken,
        submissionId: submission.id,
      })
    } catch (err) {
      console.warn(
        '[private-tender] ack email failed',
        err instanceof Error ? err.message : err
      )
    }

    // Lightweight analytics — fail-soft (no authenticated actor on guest submit)
    try {
      const { getFirestore } = require('../../../../backend/config/firebaseAdmin')
      await getFirestore().collection('productEvents').add({
        eventName: 'private_tender_submitted',
        timestamp: new Date().toISOString(),
        metadata: { submissionId: submission.id, province: submission.province },
        meaningful: true,
      })
    } catch {
      /* fail-soft */
    }

    return NextResponse.json(
      {
        success: true,
        data: svc.toPublicStatus(submission),
        acknowledgement:
          'Thank you — your private tender submission has been received and is awaiting verification. Publication is not guaranteed.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[private-tender] submit failed', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit private tender',
      },
      { status: 500 }
    )
  }
}
