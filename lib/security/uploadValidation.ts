export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
])

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function validateUploadFile(file: File): string | null {
  if (file.size <= 0) return 'Empty file'
  if (file.size > MAX_UPLOAD_BYTES) return 'File exceeds 10MB limit'
  const mime = (file.type || '').toLowerCase()
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mime)) {
    return `File type not allowed: ${mime || 'unknown'}`
  }
  return null
}
