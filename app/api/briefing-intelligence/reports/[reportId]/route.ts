import { NextRequest } from 'next/server'
import { GET as GetReport } from '../../[reportId]/route'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ reportId: string }> }
) {
  return GetReport(request, props)
}

