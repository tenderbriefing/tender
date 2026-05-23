import { NextRequest, NextResponse } from 'next/server'
import { fileProcessingService } from '@/lib/services/fileProcessingService'

export async function POST(request: NextRequest) {
  try {
    const { publicId, operation, options = {} } = await request.json()

    if (!publicId || !operation) {
      return NextResponse.json(
        { error: 'PublicId and operation are required' },
        { status: 400 }
      )
    }

    let result: any

    switch (operation) {
      case 'extract-text':
        result = await fileProcessingService.extractTextFromDocument(publicId)
        break
      
      case 'generate-thumbnail':
        result = await fileProcessingService.generateThumbnail(publicId, options.size)
        break
      
      case 'compress':
        result = await fileProcessingService.compressFile(publicId, options.quality)
        break
      
      case 'convert':
        result = await fileProcessingService.convertDocument(publicId, options.format)
        break
      
      case 'responsive-images':
        result = await fileProcessingService.generateResponsiveImages(publicId)
        break
      
      case 'process-image':
        result = await fileProcessingService.processImage(publicId, options)
        break
      
      case 'get-info':
        result = await fileProcessingService.getFileInfo(publicId)
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('Error processing file:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}
