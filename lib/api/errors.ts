import { NextResponse } from 'next/server'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    requestId?: string
  }
}

export function apiError(
  status: number,
  code: string,
  message: string,
  requestId?: string
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(requestId ? { requestId } : {}) } },
    { status }
  )
}

/** Legacy-compatible envelope used by many existing clients. */
export function legacyError(status: number, message: string, requestId?: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      errorCode: undefined as string | undefined,
      requestId,
    },
    { status }
  )
}
