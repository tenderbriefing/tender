import { NextRequest, NextResponse } from 'next/server'

import { backend } from '@/lib/backend/loadServices'

import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

import {

  toPublicSyncStatus,

  toPublicTenderBriefing,

} from '@/lib/security/publicTender'



export const dynamic = 'force-dynamic'



function filterVisibleTenders(

  tenders: TenderBriefing[],

  user: Awaited<ReturnType<typeof verifyApiUser>>

) {

  if (!user) {

    return tenders.filter((t) => t.visibility !== 'private')

  }

  if (user.userType === 'admin') return tenders

  return tenders.filter(

    (t) => t.visibility !== 'private' || (t.visibility === 'private' && t.ownerUid === user.uid)

  )

}



export async function GET(request: NextRequest) {

  try {

    const storage = backend.getStorage()

    const { searchParams } = new URL(request.url)

    const user = await verifyApiUser(request.headers.get('authorization'))



    const allTenders = await storage.getTenderBriefings({

      compulsoryOnly: searchParams.get('compulsoryOnly') === 'true',

      province: searchParams.get('province') || undefined,

      sector: searchParams.get('sector') || undefined,

      status: searchParams.get('status') || undefined,

    })



    const visible = filterVisibleTenders(allTenders, user)



    const offset = Math.max(0, Number(searchParams.get('offset') || 0))

    const limitParam = searchParams.get('limit')

    const limit = limitParam ? Math.min(Math.max(1, Number(limitParam)), 500) : null

    const page = limit ? visible.slice(offset, offset + limit) : visible



    const data = user ? page : page.map(toPublicTenderBriefing)



    const sync = backend.incrementalSync()

    const syncStatus = await sync.getSyncStatus()

    const publicSync = toPublicSyncStatus({
      lastSuccessfulSync:
        typeof syncStatus.lastSuccessfulSync === 'string'
          ? syncStatus.lastSuccessfulSync
          : null,
      lastUpdated:
        typeof syncStatus.lastUpdated === 'string' ? syncStatus.lastUpdated : null,
      apiHealth:
        typeof syncStatus.apiHealth === 'string' ? syncStatus.apiHealth : 'unknown',
      isRunning: Boolean(syncStatus.isRunning),
    })



    return NextResponse.json({

      success: true,

      data,

      count: data.length,

      total: visible.length,

      offset,

      hasMore: limit ? offset + page.length < visible.length : false,

      lastUpdated: publicSync.lastUpdated,

      syncStatus: publicSync,

    })

  } catch (error) {

    return NextResponse.json(

      {

        success: false,

        error: error instanceof Error ? error.message : 'Failed to load tender briefings',

      },

      { status: 500 }

    )

  }

}

