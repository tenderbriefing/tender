import {
  defaultProcurementFilters,
  type ProcurementFilterState,
} from './filters'

export const FILTER_STORAGE_KEY = 'tenderbriefing-procurement-filters'

export function loadSavedFilters(): ProcurementFilterState {
  if (typeof window === 'undefined') return defaultProcurementFilters
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return defaultProcurementFilters
    const parsed = JSON.parse(raw) as Partial<ProcurementFilterState>
    return { ...defaultProcurementFilters, ...parsed }
  } catch {
    return defaultProcurementFilters
  }
}

export function saveFilters(filters: ProcurementFilterState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    /* ignore quota errors */
  }
}

export function clearSavedFilters() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(FILTER_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
