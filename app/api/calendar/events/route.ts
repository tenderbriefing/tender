import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const storage = backend.getStorage()
    const calendar = backend.calendar()
    const { searchParams } = new URL(request.url)

    const tenderId = searchParams.get('tenderId')
    let tenders = await storage.getTenderBriefings()

    if (tenderId) {
      const tender = await storage.getTenderBriefingById(tenderId)
      tenders = tender ? [tender] : []
    }

    const events = calendar.getAllCalendarEvents(tenders)
    return NextResponse.json({ success: true, data: events, count: events.length })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load calendar events',
      },
      { status: 500 }
    )
  }
}
