import * as XLSX from 'xlsx'
import {
  OUTREACH_MAX_RECIPIENTS,
  OUTREACH_MAX_UPLOAD_BYTES,
  OUTREACH_MAX_WORKBOOK_ROWS,
} from './featureFlag'
import type { ParsedOutreachRow } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normHeader(h: unknown): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function mapHeader(h: string): 'name' | 'companyName' | 'email' | null {
  const n = normHeader(h)
  if (n === 'name') return 'name'
  if (n === 'company name' || n === 'company' || n === 'companyname') return 'companyName'
  if (n === 'email' || n === 'e-mail' || n === 'email address') return 'email'
  return null
}

export function isValidOutreachEmail(raw: string): boolean {
  const e = String(raw || '')
    .trim()
    .toLowerCase()
  if (!e || e.length > 254) return false
  if (!EMAIL_RE.test(e)) return false
  if (e.includes('..') || e.startsWith('.') || e.endsWith('.')) return false
  return true
}

export function normaliseOutreachEmail(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
}

export type ParseSpreadsheetResult =
  | {
      ok: true
      rows: ParsedOutreachRow[]
      totalRows: number
      validRows: number
      invalidRows: number
      duplicateRows: number
      sendableCandidates: number
    }
  | { ok: false; error: string; code: string }

/**
 * Parse a Founder-uploaded .xlsx buffer into Name / Company Name / Email rows.
 * Does not execute formulas beyond SheetJS cell values already stored.
 */
export function parseOutreachXlsx(buffer: Buffer, opts?: { fileName?: string }): ParseSpreadsheetResult {
  const name = String(opts?.fileName || '').toLowerCase()
  if (name && !name.endsWith('.xlsx')) {
    return { ok: false, error: 'Only .xlsx files are accepted.', code: 'invalid_extension' }
  }
  if (!buffer?.length) {
    return { ok: false, error: 'Empty upload.', code: 'empty_upload' }
  }
  if (buffer.length > OUTREACH_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File exceeds maximum size of ${Math.floor(OUTREACH_MAX_UPLOAD_BYTES / (1024 * 1024))} MiB.`,
      code: 'file_too_large',
    }
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      cellNF: false,
      cellStyles: false,
      sheetStubs: false,
    })
  } catch {
    return { ok: false, error: 'Malformed workbook. Could not parse .xlsx.', code: 'malformed_workbook' }
  }

  const sheetName = workbook.SheetNames?.[0]
  if (!sheetName) {
    return { ok: false, error: 'Workbook has no sheets.', code: 'empty_workbook' }
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return { ok: false, error: 'Workbook sheet is empty.', code: 'empty_workbook' }
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  }) as unknown[][]

  if (!matrix.length) {
    return { ok: false, error: 'Workbook has no rows.', code: 'empty_workbook' }
  }
  if (matrix.length > OUTREACH_MAX_WORKBOOK_ROWS) {
    return {
      ok: false,
      error: `Workbook exceeds maximum of ${OUTREACH_MAX_WORKBOOK_ROWS} rows.`,
      code: 'too_many_rows',
    }
  }

  const header = (matrix[0] || []).map((c) => String(c ?? ''))
  const col: Partial<Record<'name' | 'companyName' | 'email', number>> = {}
  header.forEach((h, i) => {
    const key = mapHeader(h)
    if (key && col[key] == null) col[key] = i
  })
  if (col.name == null) {
    return { ok: false, error: 'Missing required column: Name', code: 'missing_header_name' }
  }
  if (col.companyName == null) {
    return {
      ok: false,
      error: 'Missing required column: Company Name',
      code: 'missing_header_company',
    }
  }
  if (col.email == null) {
    return { ok: false, error: 'Missing required column: Email', code: 'missing_header_email' }
  }

  const rows: ParsedOutreachRow[] = []
  const seen = new Map<string, number>()
  let invalidRows = 0
  let duplicateRows = 0
  let validRows = 0

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] || []
    const nameVal = String(line[col.name!] ?? '').trim()
    const companyVal = String(line[col.companyName!] ?? '').trim()
    const emailRaw = String(line[col.email!] ?? '').trim()
    const rowNumber = r + 1

    if (!nameVal && !companyVal && !emailRaw) continue

    if (!nameVal || !companyVal || !emailRaw) {
      invalidRows += 1
      rows.push({
        name: nameVal,
        companyName: companyVal,
        email: emailRaw,
        normalisedEmail: normaliseOutreachEmail(emailRaw),
        status: 'invalid',
        reason: !nameVal
          ? 'missing_name'
          : !companyVal
            ? 'missing_company'
            : 'missing_email',
        rowNumber,
      })
      continue
    }

    if (!isValidOutreachEmail(emailRaw)) {
      invalidRows += 1
      rows.push({
        name: nameVal,
        companyName: companyVal,
        email: emailRaw,
        normalisedEmail: normaliseOutreachEmail(emailRaw),
        status: 'invalid',
        reason: 'malformed_email',
        rowNumber,
      })
      continue
    }

    const normalisedEmail = normaliseOutreachEmail(emailRaw)
    if (seen.has(normalisedEmail)) {
      duplicateRows += 1
      rows.push({
        name: nameVal,
        companyName: companyVal,
        email: emailRaw,
        normalisedEmail,
        status: 'duplicate',
        reason: 'duplicate_email',
        rowNumber,
      })
      continue
    }

    seen.set(normalisedEmail, rowNumber)
    validRows += 1
    rows.push({
      name: nameVal,
      companyName: companyVal,
      email: emailRaw,
      normalisedEmail,
      status: 'ready',
      rowNumber,
    })
  }

  const sendableCandidates = rows.filter((r) => r.status === 'ready').length
  if (sendableCandidates === 0) {
    return {
      ok: false,
      error: 'No valid recipients found in the workbook.',
      code: 'zero_valid_recipients',
    }
  }
  if (sendableCandidates > OUTREACH_MAX_RECIPIENTS) {
    return {
      ok: false,
      error: `Sendable recipients (${sendableCandidates}) exceed the campaign limit of ${OUTREACH_MAX_RECIPIENTS}.`,
      code: 'over_recipient_limit',
    }
  }

  return {
    ok: true,
    rows,
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows,
    sendableCandidates,
  }
}
