import { NextRequest, NextResponse } from 'next/server'
import { openaiService } from '@/lib/services/openaiService'

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const response = await openaiService.generateChatResponse(message, context)

    return NextResponse.json({
      success: true,
      response
    })
  } catch (error) {
    console.error('Error generating chat response:', error)
    return NextResponse.json(
      { error: 'Failed to generate chat response' },
      { status: 500 }
    )
  }
}
