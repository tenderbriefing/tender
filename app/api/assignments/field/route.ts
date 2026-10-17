/**
 * Phase 16 — Secure field execution API (token or assigned YA).
 * Never exposes customer billing, internal Ops notes, or other requests.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

function fieldService() {
  return require('../../../../backend/services/ops/fieldExecutionService')
}

function actorFrom(request: NextRequest, body: Record<string, unknown> = {}) {
  return (async () => {
    const token = String(
      body.token || request.nextUrl.searchParams.get('token') || ''
    ).trim()
    const authHeader = request.headers.get('authorization')
    const user = await verifyApiUser(authHeader, ['youth-agent', 'admin'])
    if (user?.userType === 'admin') {
      return { role: 'admin' as const, uid: user.uid, email: user.email, token: token || undefined }
    }
    if (user?.userType === 'youth-agent') {
      return { uid: user.uid, email: user.email, token: token || undefined }
    }
    if (token) return { token }
    return null
  })()
}

export async function GET(request: NextRequest) {
  const requestId = String(request.nextUrl.searchParams.get('requestId') || '').trim()
  if (!requestId) {
    return NextResponse.json({ success: false, error: 'Missing requestId' }, { status: 400 })
  }
  try {
    const actor = await actorFrom(request)
    if (!actor) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const svc = fieldService()
    const preview = await svc.getFieldPreview(requestId, actor)
    if (!preview) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: preview })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Load failed'
    const status = /Forbidden/i.test(message) ? 403 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let body: Record<string, unknown> = {}
    let form: FormData | null = null

    if (contentType.includes('multipart/form-data')) {
      form = await request.formData()
      body = {
        requestId: form.get('requestId'),
        token: form.get('token'),
        action: form.get('action'),
        category: form.get('category'),
        notes: form.get('notes'),
        lat: form.get('lat'),
        lng: form.get('lng'),
        accuracy: form.get('accuracy'),
        locationDenied: form.get('locationDenied'),
      }
    } else {
      body = await request.json().catch(() => ({}))
    }

    const requestId = String(body.requestId || '').trim()
    const action = String(body.action || '').trim().toLowerCase()
    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: 'requestId and action required' },
        { status: 400 }
      )
    }

    const actor = await actorFrom(request, body)
    if (!actor) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const svc = fieldService()
    let result: unknown

    switch (action) {
      case 'check_in':
        result = await svc.checkIn(requestId, actor, {
          lat: body.lat != null && body.lat !== '' ? Number(body.lat) : null,
          lng: body.lng != null && body.lng !== '' ? Number(body.lng) : null,
          accuracy: body.accuracy != null && body.accuracy !== '' ? Number(body.accuracy) : null,
          locationDenied: body.locationDenied === true || body.locationDenied === 'true',
        })
        break
      case 'save_notes':
        result = await svc.saveFieldNotes(requestId, actor, String(body.notes || ''))
        break
      case 'upload_evidence': {
        if (!form) {
          return NextResponse.json(
            { success: false, error: 'multipart file required' },
            { status: 400 }
          )
        }
        const file = form.get('file')
        if (!(file instanceof File)) {
          return NextResponse.json({ success: false, error: 'file required' }, { status: 400 })
        }
        const buffer = Buffer.from(await file.arrayBuffer())
        result = await svc.uploadFieldEvidence(requestId, actor, {
          buffer,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          category: String(body.category || 'attendance_proof'),
          size: file.size,
        })
        break
      }
      case 'confirm_attendance':
        result = await svc.confirmAttendanceAndSubmit(requestId, actor, {
          notes: body.notes != null ? String(body.notes) : undefined,
        })
        break
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
    }

    const preview = await svc.getFieldPreview(requestId, actor)
    return NextResponse.json({
      success: true,
      data: {
        action,
        result,
        preview,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action failed'
    const status = /Forbidden/i.test(message) ? 403 : /15MB|Unsupported/.test(message) ? 415 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
