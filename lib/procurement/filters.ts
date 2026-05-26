import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { isBriefingThisWeek, isClosingSoon } from './dates'

export interface ProcurementFilterState {
  search: string
  tenderNumber: string
  province: string
  department: string
  category: string
  tenderType: string
  status: string
  closingFrom: string
  closingTo: string
  briefingRequired: boolean
  compulsoryOnly: boolean
  closingSoon: boolean
  briefingsThisWeek: boolean
  briefingType: '' | 'compulsory' | 'has_briefing' | 'optional' | 'none'
}

export const defaultProcurementFilters: ProcurementFilterState = {
  search: '',
  tenderNumber: '',
  province: '',
  department: '',
  category: '',
  tenderType: '',
  status: 'active',
  closingFrom: '',
  closingTo: '',
  briefingRequired: false,
  compulsoryOnly: false,
  closingSoon: false,
  briefingsThisWeek: false,
  briefingType: '',
}

export type TenderSortKey =
  | 'closingDate'
  | 'briefingDate'
  | 'tenderNumber'
  | 'department'
  | 'province'

export function filterTenders(
  tenders: TenderBriefing[],
  filters: ProcurementFilterState
): TenderBriefing[] {
  return tenders.filter((t) => {
    if (filters.status && t.status !== filters.status) return false

    if (filters.compulsoryOnly && !t.briefingCompulsory) return false
    if (filters.briefingRequired && !t.briefingDate && !t.briefingCompulsory) return false
    if (filters.closingSoon && !isClosingSoon(t.closingDate)) return false
    if (filters.briefingsThisWeek && !isBriefingThisWeek(t.briefingDate)) return false

    if (filters.briefingType === 'compulsory' && !t.briefingCompulsory) return false
    if (filters.briefingType === 'has_briefing' && !t.briefingDate) return false
    if (filters.briefingType === 'optional' && t.briefingCompulsory) return false
    if (filters.briefingType === 'none' && (t.briefingDate || t.briefingCompulsory)) return false

    if (filters.province && t.province !== filters.province) return false
    if (filters.department && t.department !== filters.department) return false
    if (filters.category && t.industrySector !== filters.category && t.category !== filters.category) {
      return false
    }
    if (filters.tenderType && t.procurementMethod !== filters.tenderType) return false

    if (filters.tenderNumber) {
      const num = (t.tenderNumber || '').toLowerCase()
      if (!num.includes(filters.tenderNumber.toLowerCase())) return false
    }

    if (filters.search) {
      const q = filters.search.toLowerCase()
      const hay = `${t.title} ${t.description} ${t.summary} ${t.department}`.toLowerCase()
      if (!hay.includes(q)) return false
    }

    if (filters.closingFrom) {
      const close = t.closingDate ? new Date(t.closingDate) : null
      const from = new Date(filters.closingFrom)
      if (!close || close < from) return false
    }
    if (filters.closingTo) {
      const close = t.closingDate ? new Date(t.closingDate) : null
      const to = new Date(filters.closingTo)
      if (!close || close > to) return false
    }

    return true
  })
}

export function sortTenders(
  tenders: TenderBriefing[],
  sortKey: TenderSortKey,
  direction: 'asc' | 'desc'
): TenderBriefing[] {
  const mult = direction === 'asc' ? 1 : -1
  return [...tenders].sort((a, b) => {
    const av = String(a[sortKey] ?? '')
    const bv = String(b[sortKey] ?? '')
    if (sortKey === 'closingDate' || sortKey === 'briefingDate') {
      const ad = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0
      const bd = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0
      return (ad - bd) * mult
    }
    return av.localeCompare(bv) * mult
  })
}

export function extractFilterOptions(tenders: TenderBriefing[]) {
  const provinces = new Set<string>()
  const departments = new Set<string>()
  const categories = new Set<string>()
  const tenderTypes = new Set<string>()

  for (const t of tenders) {
    if (t.province) provinces.add(t.province)
    if (t.department) departments.add(t.department)
    if (t.industrySector) categories.add(t.industrySector)
    if (t.procurementMethod) tenderTypes.add(t.procurementMethod)
  }

  return {
    provinces: Array.from(provinces).sort(),
    departments: Array.from(departments).sort(),
    categories: Array.from(categories).sort(),
    tenderTypes: Array.from(tenderTypes).sort(),
  }
}
