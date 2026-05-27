import { backend } from '@/lib/backend/loadServices'
import {
  filterPlatformVisible,
  isPlatformVisibleToViewer,
} from '@/lib/security/publicTender'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export async function getPublicTenders(): Promise<TenderBriefing[]> {
  try {
    const storage = backend.getStorage()
    const tenders = await storage.getTenderBriefings()
    return filterPlatformVisible(tenders, null)
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
