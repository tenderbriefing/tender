/** Phase 1 private tender publishing constants. */

export const PRIVATE_TENDER_COLLECTION = 'privateTenderSubmissions'

export const PRIVATE_TENDER_SOURCE = 'company_submission'

export const MAX_TENDER_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10 MB

export const ALLOWED_TENDER_DOCUMENT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export const ALLOWED_TENDER_DOCUMENT_EXT = new Set(['pdf', 'doc', 'docx'])

export const PRIVATE_TENDER_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
  'National',
] as const

export function mimeFromFileName(fileName: string): string | null {
  const ext = String(fileName || '')
    .split('.')
    .pop()
    ?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return null
}

export function isAllowedTenderDocument(fileName: string, contentType?: string): boolean {
  const ext = String(fileName || '')
    .split('.')
    .pop()
    ?.toLowerCase()
  if (!ext || !ALLOWED_TENDER_DOCUMENT_EXT.has(ext)) return false
  if (!contentType) return true
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() || ''
  if (normalized === 'application/octet-stream') return true
  return ALLOWED_TENDER_DOCUMENT_MIME.has(normalized)
}
