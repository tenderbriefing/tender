import type { AdminDashboardStats, SyncStatus, TenderBriefing } from '@/lib/tenderBriefing/types'

/** Fields safe for anonymous visitors (marketing + /tenders). */
export type PublicTenderBriefing = Pick<
  TenderBriefing,
  | 'id'
  | 'ocid'
  | 'tenderNumber'
  | 'title'
  | 'description'
  | 'department'
  | 'buyer'
  | 'province'
  | 'category'
  | 'industrySector'
  | 'procurementMethod'
  | 'status'
  | 'publishedDate'
  | 'closingDate'
  | 'briefingDate'
  | 'briefingTime'
  | 'briefingVenue'
  | 'briefingCompulsory'
  | 'contactPerson'
  | 'contactEmail'
  | 'contactPhone'
  | 'meetingLink'
  | 'detailUrl'
  | 'summary'
  | 'visibility'
> & {
  documents: Array<{
    id?: string
    title?: string
    url?: string
    datePublished?: string
  }>
}

export type PublicSyncStatus = {
  lastUpdated: string | null
  apiHealth: 'healthy' | 'degraded' | 'syncing' | 'unknown'
  isRunning: boolean
}

export type PublicTenderStats = Pick<
  AdminDashboardStats,
  | 'totalBriefings'
  | 'compulsoryBriefings'
  | 'closingWithin7Days'
  | 'provincesRepresented'
  | 'topDepartments'
>

export function toPublicTenderBriefing(tender: TenderBriefing): PublicTenderBriefing {
  if (tender.visibility === 'private') {
    return {
      id: tender.id,
      ocid: tender.ocid,
      tenderNumber: tender.tenderNumber,
      title: 'Private opportunity',
      description: '',
      department: '',
      buyer: '',
      province: tender.province || '',
      category: '',
      industrySector: '',
      procurementMethod: '',
      status: tender.status,
      publishedDate: tender.publishedDate,
      closingDate: tender.closingDate,
      briefingDate: '',
      briefingTime: '',
      briefingVenue: '',
      briefingCompulsory: false,
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      meetingLink: '',
      detailUrl: '',
      summary: '',
      visibility: 'private',
      documents: [],
    }
  }

  return {
    id: tender.id,
    ocid: tender.ocid,
    tenderNumber: tender.tenderNumber,
    title: tender.title,
    description: tender.description,
    department: tender.department,
    buyer: tender.buyer,
    province: tender.province,
    category: tender.category,
    industrySector: tender.industrySector,
    procurementMethod: tender.procurementMethod,
    status: tender.status,
    publishedDate: tender.publishedDate,
    closingDate: tender.closingDate,
    briefingDate: tender.briefingDate,
    briefingTime: tender.briefingTime,
    briefingVenue: tender.briefingVenue,
    briefingCompulsory: tender.briefingCompulsory,
    contactPerson: tender.contactPerson,
    contactEmail: tender.contactEmail,
    contactPhone: tender.contactPhone,
    meetingLink: tender.meetingLink,
    detailUrl: tender.detailUrl,
    summary: tender.summary,
    visibility: tender.visibility || 'public',
    documents: (tender.documents || []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      url: doc.url,
      datePublished: doc.datePublished,
    })),
  }
}

export function toPublicSyncStatus(
  sync: Pick<SyncStatus, 'lastSuccessfulSync' | 'lastUpdated' | 'apiHealth' | 'isRunning'>
): PublicSyncStatus {
  const healthy = sync.apiHealth === 'healthy' || sync.apiHealth === 'ok'
  return {
    lastUpdated: sync.lastSuccessfulSync || sync.lastUpdated || null,
    apiHealth: sync.isRunning ? 'syncing' : healthy ? 'healthy' : 'degraded',
    isRunning: Boolean(sync.isRunning),
  }
}

export function toPublicTenderStats(stats: AdminDashboardStats): PublicTenderStats {
  return {
    totalBriefings: stats.totalBriefings,
    compulsoryBriefings: stats.compulsoryBriefings,
    closingWithin7Days: stats.closingWithin7Days,
    provincesRepresented: stats.provincesRepresented,
    topDepartments: stats.topDepartments,
  }
}

export function toMinimalHealthResponse(payload: {
  status: string
  connected?: boolean
}) {
  return {
    status: payload.status === 'ok' ? 'ok' : 'degraded',
    connected: payload.connected !== false,
  }
}
