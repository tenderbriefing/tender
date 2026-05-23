import { NextRequest, NextResponse } from 'next/server'
import { fileProcessingService } from '@/lib/services/fileProcessingService'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'tenderconnect'
    const options = JSON.parse(formData.get('options') as string || '{}')

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload and process file
    const result = await fileProcessingService.uploadFile(buffer, options, folder)

    return NextResponse.json({
      success: true,
      file: result,
    })
  } catch (error) {
    console.error('Error processing file upload:', error)
    return NextResponse.json(
      { error: 'Failed to process file upload' },
      { status: 500 }
    )
  }
}
