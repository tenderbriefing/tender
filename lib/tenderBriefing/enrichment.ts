import type { AttendanceRequest } from './types'

export interface TenderSnapshot {
  id: string
  tenderNumber: string | null
  title: string | null
  department: string | null
  province: string | null
  category: string | null
  briefingDate: string | null
  briefingVenue: string | null
  briefingTime?: string | null
  closingDate: string | null
  briefingCompulsory: boolean
  detailUrl?: string | null
  documents?: unknown
}

export interface EnrichedAttendanceRequest extends AttendanceRequest {
  tender?: TenderSnapshot | null
  department?: string
  tenderNumber?: string
  closingDate?: string
  briefingCompulsory?: boolean
}

export function tenderLabelFromRequest(req: EnrichedAttendanceRequest) {
  return req.tender?.tenderNumber || req.tenderNumber || 'Tender'
}

export function departmentFromRequest(req: EnrichedAttendanceRequest) {
  return req.tender?.department || req.department
}
