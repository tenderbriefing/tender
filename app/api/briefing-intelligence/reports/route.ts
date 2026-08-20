import { NextRequest } from 'next/server'
import { GET as ListGet } from '../route'

export const dynamic = 'force-dynamic'

// Compatibility wrapper for existing UI routes expecting:
//   /api/briefing-intelligence/reports
export async function GET(request: NextRequest) {
  return ListGet(request)
}

