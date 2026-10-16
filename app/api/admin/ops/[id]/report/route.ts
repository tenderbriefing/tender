import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

function reportService() {
  return require('../../../../../../backend/services/ops/reportProductionService')
}

function opsService() {
  return require('../../../../../../backend/services/ops/opsLifecycleService')
}

/** GET active report draft + versions (admin only). */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  try {
    const reports = reportService()
    const ops = opsService()
    const { request: doc, report } = await reports.getActiveReport(params.id)
    const versions = await reports.listVersions(params.id)
    return NextResponse.json({
      success: true,
      data: {
        row: ops.toOpsBoardRow(doc),
        report,
        versions: versions.map((v: { id: string; version: number; status: string; approvalStatus: string; createdAt: string; approvedAt?: string }) => ({
          id: v.id,
          version: v.version,
          status: v.status,
          approvalStatus: v.approvalStatus,
          createdAt: v.createdAt,
          approvedAt: v.approvedAt || null,
        })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 404 }
    )
  }
}

/**
 * POST actions: generate | edit | regenerate_section | approve
 * approve NEVER sends email.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  const adminUser = { uid: user.uid, email: user.email }

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').trim()
    const reports = reportService()
    const ops = opsService()
    let result: any

    switch (action) {
      case 'generate':
        result = await reports.generateDraft(params.id, adminUser)
        break
      case 'edit':
        result = await reports.editReport(params.id, body.edits || body, adminUser)
        break
      case 'regenerate_section':
        result = await reports.regenerateReportSection(
          params.id,
          String(body.sectionId || ''),
          { force: body.force === true },
          adminUser
        )
        break
      case 'approve':
        result = await reports.approveFinalReport(params.id, adminUser)
        break
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        emailSent: action === 'approve' ? false : null,
        row: ops.toOpsBoardRow(result.request),
        report: {
          id: result.report?.id,
          version: result.report?.version,
          status: result.report?.status,
          approvalStatus: result.report?.approvalStatus,
          draft: result.report?.draft,
          pdfFileName: result.report?.pdfFileName || null,
          docxFileName: result.report?.docxFileName || null,
          sourceConflicts: result.report?.draft?.sourceConflicts || [],
          approvedAt: result.report?.approvedAt || null,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Report action failed',
      },
      { status: 400 }
    )
  }
}
