import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface FileProcessingOptions {
  quality?: 'auto' | number
  format?: 'auto' | 'jpg' | 'png' | 'webp' | 'pdf'
  width?: number
  height?: number
  crop?: 'fill' | 'fit' | 'scale' | 'crop'
  gravity?: 'auto' | 'face' | 'center' | 'north' | 'south' | 'east' | 'west'
}

export interface ProcessedFile {
  publicId: string
  url: string
  secureUrl: string
  format: string
  width: number
  height: number
  size: number
  bytes: number
  createdAt: string
}

export interface DocumentAnalysis {
  text: string
  pages: number
  wordCount: number
  language: string
  confidence: number
  entities: Array<{
    text: string
    type: string
    confidence: number
  }>
}

class FileProcessingService {
  /**
   * Upload file to Cloudinary with processing
   */
  async uploadFile(
    file: File | Buffer,
    options: FileProcessingOptions = {},
    folder: string = 'tenderconnect'
  ): Promise<ProcessedFile> {
    try {
      const uploadOptions = {
        folder,
        quality: options.quality || 'auto',
        format: options.format || 'auto',
        ...(options.width && { width: options.width }),
        ...(options.height && { height: options.height }),
        ...(options.crop && { crop: options.crop }),
        ...(options.gravity && { gravity: options.gravity }),
        resource_type: 'auto' as const,
      }

      const result = await cloudinary.uploader.upload(file as any, uploadOptions)

      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        size: result.bytes,
        bytes: result.bytes,
        createdAt: result.created_at,
      }
    } catch (error) {
      console.error('Error uploading file to Cloudinary:', error)
      throw new Error('Failed to upload file')
    }
  }

  /**
   * Process image with transformations
   */
  async processImage(
    publicId: string,
    transformations: {
      width?: number
      height?: number
      crop?: string
      quality?: string | number
      format?: string
      effects?: string[]
    } = {}
  ): Promise<string> {
    try {
      const transformationArray: any[] = []
      
      if (transformations.width) transformationArray.push({ width: transformations.width })
      if (transformations.height) transformationArray.push({ height: transformations.height })
      if (transformations.crop) transformationArray.push({ crop: transformations.crop })
      if (transformations.quality) transformationArray.push({ quality: transformations.quality })
      if (transformations.format) transformationArray.push({ format: transformations.format })
      if (transformations.effects) transformationArray.push({ effect: transformations.effects.join(',') })

      const url = cloudinary.url(publicId, {
        transformation: transformationArray,
      })

      return url
    } catch (error) {
      console.error('Error processing image:', error)
      throw new Error('Failed to process image')
    }
  }

  /**
   * Extract text from document using OCR
   */
  async extractTextFromDocument(publicId: string): Promise<DocumentAnalysis> {
    try {
      // Use Cloudinary's OCR feature
      const result = await cloudinary.api.resource(publicId, {
        ocr: 'adv_ocr',
      })

      // Parse OCR results
      const text = result.ocr?.adv_ocr?.data?.[0]?.text || ''
      const pages = result.pages || 1
      const wordCount = text.split(/\s+/).length

      return {
        text,
        pages,
        wordCount,
        language: 'en', // Default, could be detected
        confidence: 0.8, // Default confidence
        entities: [], // Could be enhanced with NLP
      }
    } catch (error) {
      console.error('Error extracting text from document:', error)
      throw new Error('Failed to extract text from document')
    }
  }

  /**
   * Generate thumbnail for document
   */
  async generateThumbnail(publicId: string, size: number = 300): Promise<string> {
    try {
      const url = cloudinary.url(publicId, {
        transformation: [
          { width: size, height: size, crop: 'fill', quality: 'auto' },
          { format: 'jpg' },
        ],
      })

      return url
    } catch (error) {
      console.error('Error generating thumbnail:', error)
      throw new Error('Failed to generate thumbnail')
    }
  }

  /**
   * Compress file
   */
  async compressFile(publicId: string, quality: number = 80): Promise<string> {
    try {
      const url = cloudinary.url(publicId, {
        transformation: [
          { quality: quality },
          { format: 'auto' },
        ],
      })

      return url
    } catch (error) {
      console.error('Error compressing file:', error)
      throw new Error('Failed to compress file')
    }
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(publicId: string): Promise<boolean> {
    try {
      await cloudinary.uploader.destroy(publicId)
      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      return false
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId)
      return result
    } catch (error) {
      console.error('Error getting file info:', error)
      throw new Error('Failed to get file information')
    }
  }

  /**
   * Generate multiple sizes for responsive images
   */
  async generateResponsiveImages(publicId: string): Promise<{
    small: string
    medium: string
    large: string
    original: string
  }> {
    try {
      const baseUrl = cloudinary.url(publicId)
      
      return {
        small: cloudinary.url(publicId, { width: 300, height: 300, crop: 'fill', quality: 'auto' }),
        medium: cloudinary.url(publicId, { width: 600, height: 600, crop: 'fill', quality: 'auto' }),
        large: cloudinary.url(publicId, { width: 1200, height: 1200, crop: 'fill', quality: 'auto' }),
        original: baseUrl,
      }
    } catch (error) {
      console.error('Error generating responsive images:', error)
      throw new Error('Failed to generate responsive images')
    }
  }

  /**
   * Convert document to different format
   */
  async convertDocument(publicId: string, targetFormat: string): Promise<string> {
    try {
      const url = cloudinary.url(publicId, {
        transformation: [
          { format: targetFormat },
          { quality: 'auto' },
        ],
      })

      return url
    } catch (error) {
      console.error('Error converting document:', error)
      throw new Error('Failed to convert document')
    }
  }
}

export const fileProcessingService = new FileProcessingService()
