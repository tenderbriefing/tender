import { backend } from '@/lib/backend/loadServices'
import {
  filterPlatformVisible,
  isPlatformVisibleToViewer,
} from '@/lib/security/publicTender'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export async function getPublicTenders(): Promise<TenderBriefing[]> {
  try {
    const storage = backend.getStorage()
    if (typeof storage.listTenderBriefingsPage !== 'function') {
      const tenders = await storage.getTenderBriefings({ limit: 2000 })
      return filterPlatformVisible(tenders, null)
    }
    const acc: TenderBriefing[] = []
    let cursor: string | undefined
    for (let i = 0; i < 25 && acc.length < 2000; i += 1) {
      const page = await storage.listTenderBriefingsPage({
        pageSize: 80,
        cursor,
        scanBudget: 160,
      })
      acc.push(...page.items)
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    return filterPlatformVisible(acc.slice(0, 2000), null)
  } catch {
    return []
  }
}

export async function getPublicTenderById(id: string): Promise<TenderBriefing | null> {
  try {
    const storage = backend.getStorage()
    const tender = await storage.getTenderBriefingById(id)
    if (!tender) return null
    if (!isPlatformVisibleToViewer(tender, null)) return null
    return tender
  } catch {
    return null
  }
}
