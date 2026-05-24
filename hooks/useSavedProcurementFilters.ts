'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  defaultProcurementFilters,
  type ProcurementFilterState,
} from '@/lib/procurement/filters'
import { loadSavedFilters, saveFilters } from '@/lib/procurement/savedFilters'

export function useSavedProcurementFilters() {
  const [filters, setFiltersState] = useState<ProcurementFilterState>(defaultProcurementFilters)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setFiltersState(loadSavedFilters())
    setHydrated(true)
  }, [])

  const setFilters = useCallback((next: ProcurementFilterState) => {
    setFiltersState(next)
    saveFilters(next)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultProcurementFilters)
    saveFilters(defaultProcurementFilters)
  }, [])

  return { filters, setFilters, resetFilters, hydrated }
}
