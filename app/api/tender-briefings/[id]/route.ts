import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storage = backend.getStorage()
    const tender = await storage.getTenderBriefingById(params.id)

    if (!tender) {
      return NextResponse.json(
        { success: false, error: 'Tender briefing not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: tender })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load tender',
      },
      { status: 500 }
    )
  }
}
