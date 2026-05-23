import { NextRequest, NextResponse } from 'next/server'
import { openaiService } from '@/lib/services/openaiService'

export async function POST(request: NextRequest) {
  try {
    const { tenderAnalysis, availableConnectors, entrepreneurProfile } = await request.json()

    if (!tenderAnalysis || !availableConnectors || !entrepreneurProfile) {
      return NextResponse.json(
        { error: 'Tender analysis, available connectors, and entrepreneur profile are required' },
        { status: 400 }
      )
    }

    const recommendations = await openaiService.recommendConnectors(
      tenderAnalysis,
      availableConnectors,
      entrepreneurProfile
    )

    return NextResponse.json({
      success: true,
      recommendations
    })
  } catch (error) {
    console.error('Error generating connector recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to generate connector recommendations' },
      { status: 500 }
    )
  }
}
