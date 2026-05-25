/**
 * Briefing report PDF summary — upload to Storage and return public/signed URL.
 */
const { getStorage } = require('./storageAdapter')

function siteBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.tenderbriefing.co.za'
  return String(base).replace(/\/$/, '')
}

function escapePdfText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .slice(0, 2000)
}

function buildMinimalPdf(lines) {
  const content = lines.map((line, i) => `BT /F1 11 Tf 50 ${750 - i * 16} Td (${escapePdfText(line)}) Tj ET`).join('\n')
  const stream = `stream\n${content}\nendstream`
  const len = Buffer.byteLength(stream, 'utf8')
  return Buffer.from(
    `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${len} >>${stream}
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000264 00000 n 
0000000400 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
480
%%EOF`,
    'utf8'
  )
}

async function generateAndAttachReportPdf({ reportId, requestId, request = {} }) {
  const storage = getStorage()
  const reports = await storage.getBriefingReports?.()
  const report =
    reports?.find((r) => r.id === reportId) ||
    (await storage.getBriefingReportById?.(reportId))

  const summaryLines = [
    'TenderBriefing — Briefing Report Summary',
    `Tender: ${request.tenderNumber || request.tenderTitle || 'N/A'}`,
    `Request: ${requestId || report?.requestId || 'N/A'}`,
    `Report: ${reportId || report?.id || 'N/A'}`,
    `Submitted: ${report?.createdAt || new Date().toISOString()}`,
    '',
    `Summary: ${report?.summary || 'See full report online.'}`,
    `Key instructions: ${report?.keyInstructions || '—'}`,
    `Submission requirements: ${report?.submissionRequirements || '—'}`,
    `Risks: ${report?.risksClarifications || '—'}`,
  ]

  const pdfBuffer = buildMinimalPdf(summaryLines)
  const fileName = `briefing-summary-${reportId || requestId}-${Date.now()}.pdf`
  const apiFallbackUrl = `${siteBaseUrl()}/api/briefing-reports/summary-pdf/${encodeURIComponent(reportId || report?.id || requestId)}`

  let pdfUrl = apiFallbackUrl
  let storagePath = null

  try {
    const firebaseStorageService = require('./integrations/firebaseStorageService')
    const upload = await firebaseStorageService.uploadBriefingProof({
      requestId: requestId || report?.requestId || 'unknown',
      fileName,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
    })
    if (upload.ok && upload.url) {
      pdfUrl = upload.url
      storagePath = upload.path || upload.gsPath
    }
  } catch {
    // fallback to on-demand API URL
  }

  if (report?.id && typeof storage.saveBriefingReport === 'function') {
    await storage.saveBriefingReport({
      ...report,
      pdfSummaryUrl: pdfUrl,
      pdfStoragePath: storagePath,
      pdfGeneratedAt: new Date().toISOString(),
    })
  }

  return { pdfUrl, storagePath, reportId: reportId || report?.id }
}

function generatePdfBufferForReport(report, request = {}) {
  const lines = [
    'TenderBriefing — Briefing Report Summary',
    `Tender: ${request.tenderNumber || request.tenderTitle || 'N/A'}`,
    `Report: ${report.id}`,
    `Summary: ${report.summary || '—'}`,
    `Key instructions: ${report.keyInstructions || '—'}`,
  ]
  return buildMinimalPdf(lines)
}

module.exports = {
  generateAndAttachReportPdf,
  generatePdfBufferForReport,
  siteBaseUrl,
}
