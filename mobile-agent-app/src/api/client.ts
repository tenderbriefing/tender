import { auth } from '../config/firebase'

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  'https://www.tenderbriefing.co.za'

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getIdToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new ApiError('Not signed in', 401)
  return user.getIdToken()
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getIdToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init.headers as Record<string, string>),
  }
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    throw new ApiError(json.error || res.statusText || 'Request failed', res.status)
  }
  return json.data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
}

export type DispatchItem = {
  requestId: string
  tenderNumber?: string
  tenderTitle?: string
  province?: string
  briefingDate?: string
  briefingTime?: string
  payoutZar?: string
  etaMinutes?: number | null
  distanceKm?: number | null
  urgency?: string
  status?: string
  canAccept?: boolean
  assignedToMe?: boolean
}

export type DispatchBoard = {
  assignments: DispatchItem[]
  opportunities: DispatchItem[]
  all?: DispatchItem[]
}

export type BriefingDetail = {
  request: Record<string, unknown>
  tender: Record<string, unknown>
  aiSummary?: { summary?: string; keyPoints?: string[] } | null
  gpsEvents?: Array<{ eventType?: string; createdAt?: string; withinGeofence?: boolean }>
  coordinates?: { lat: number | null; lng: number | null }
}

export type EarningsData = {
  completedBriefings: number
  pendingPayoutCents: number
  paidEarningsCents: number
  monthEarningsCents: number
  payouts: Array<{ id: string; status?: string; amountCents?: number; createdAt?: string }>
}

export type PerformanceData = {
  tier: string
  performanceScore: number
  reliabilityScore: number
  attendancePct: number
  missedBriefings: number
  reportQuality: number
  fraudFlags: number
  latenessPct: number
}

export const mobileApi = {
  dispatch: () => api.get<DispatchBoard>('/api/mobile/v1/dispatch'),
  briefing: (requestId: string) =>
    api.get<BriefingDetail>(`/api/mobile/v1/briefing/${requestId}`),
  checkIn: (body: Record<string, unknown>) =>
    api.post<{ id: string; withinGeofence?: boolean; distanceKm?: number | null }>(
      '/api/mobile/v1/check-in',
      body
    ),
  checkOut: (body: Record<string, unknown>) =>
    api.post<{ id: string; withinGeofence?: boolean; distanceKm?: number | null }>(
      '/api/mobile/v1/check-out',
      body
    ),
  media: (formData: FormData) => api.upload('/api/mobile/v1/media', formData),
  offlineEnqueue: (itemType: string, data: Record<string, unknown>) =>
    api.post('/api/mobile/v1/offline-sync', {
      itemType,
      data,
      clientTimestamp: new Date().toISOString(),
    }),
  offlineProcess: () =>
    api.post('/api/mobile/v1/offline-sync', { action: 'process' }),
  earnings: () => api.get<EarningsData>('/api/mobile/v1/earnings'),
  performance: () => api.get<PerformanceData>('/api/mobile/v1/performance'),
  telemetry: (event: string, metadata: Record<string, unknown>) =>
    api.post('/api/mobile/v1/telemetry', { event, metadata }),
  accept: (agentId: string, requestId: string) =>
    api.post(`/api/agents/${agentId}/accept`, { requestId }),
  decline: (agentId: string, requestId: string) =>
    api.post(`/api/agents/${agentId}/decline`, {
      requestId,
      reason: 'native_decline',
    }),
  submitReport: (body: Record<string, unknown>) =>
    api.post('/api/briefing-reports', body),
  uploadReportFile: (formData: FormData) =>
    api.upload('/api/briefing-reports/upload', formData),
}

export { API_BASE }
