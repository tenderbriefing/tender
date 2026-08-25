import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { searchParams } = new URL(request.url)
    const svc = require('../../../../backend/services/privateTenderSubmissionService.js')
    const items = await svc.listSubmissions({
      status: searchParams.get('status') || undefined,
      q: searchParams.get('q') || undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        items: items.map((item: Record<string, unknown>) => ({
          id: item.id,
          status: item.status,
          companyName: item.companyName,
          title: item.title,
          tenderReference: item.tenderReference,
          closingDate: item.closingDate,
          briefingDate: item.briefingDate,
          province: item.province,
          municipality: item.municipality,
          submittedAt: item.submittedAt,
          duplicateFlags: item.duplicateFlags || [],
          publishedTenderId: item.publishedTenderId || null,
        })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list submissions',
      },
      { status: 500 }
    )
  }
}
