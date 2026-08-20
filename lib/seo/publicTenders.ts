import { backend } from '@/lib/backend/loadServices'
import {
  filterIndexablePublicTenders,
  filterPlatformVisible,
  isPublicDetailVisibleToViewer,
} from '@/lib/security/publicTender'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

async function listTenderBriefingRecords(limit = 2000): Promise<TenderBriefing[]> {
  const storage = backend.getStorage()
  if (typeof storage.listTenderBriefingsPage !== 'function') {
    return storage.getTenderBriefings({ limit })
  }

  const acc: TenderBriefing[] = []
  let cursor: string | undefined
  for (let i = 0; i < 25 && acc.length < limit; i += 1) {
    const page = await storage.listTenderBriefingsPage({
      pageSize: 80,
      cursor,
      scanBudget: 160,
    })
    acc.push(...page.items)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return acc.slice(0, limit)
}

/** Live catalogue tenders (upcoming compulsory briefings only). */
export async function getPublicTenders(): Promise<TenderBriefing[]> {
  try {
    const tenders = await listTenderBriefingRecords()
    return filterPlatformVisible(tenders, null)
  } catch {
    return []
  }
}

/** Indexable tender detail records (active + historical compulsory briefings). */
export async function getIndexableTenders(): Promise<TenderBriefing[]> {
  try {
    const tenders = await listTenderBriefingRecords()
    return filterIndexablePublicTenders(tenders, null)
  } catch {
    return []
  }
}

/** Resolve a tender for public detail pages and SEO metadata. */
export async function getIndexableTenderById(id: string): Promise<TenderBriefing | null> {
  try {
    const storage = backend.getStorage()
    const tender = await storage.getTenderBriefingById(id)
    if (!tender) return null
    if (!isPublicDetailVisibleToViewer(tender, null)) return null
    return tender
  } catch {
    return null
  }
}

/** @deprecated Use getIndexableTenderById for SEO/detail routes. */
export async function getPublicTenderById(id: string): Promise<TenderBriefing | null> {
  return getIndexableTenderById(id)
}
