import { NextRequest, NextResponse } from 'next/server'
import { openaiService } from '@/lib/services/openaiService'

export async function POST(request: NextRequest) {
  try {
    const { documentText, tenderTitle } = await request.json()

    if (!documentText || !tenderTitle) {
      return NextResponse.json(
        { error: 'Document text and tender title are required' },
        { status: 400 }
      )
    }

    const analysis = await openaiService.analyzeTenderDocument(documentText, tenderTitle)

    return NextResponse.json({
      success: true,
      analysis
    })
  } catch (error) {
    console.error('Error analyzing tender document:', error)
    return NextResponse.json(
      { error: 'Failed to analyze tender document' },
      { status: 500 }
    )
  }
}
