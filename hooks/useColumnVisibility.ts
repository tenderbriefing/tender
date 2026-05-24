'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  COLUMN_VISIBILITY_STORAGE_KEY,
  DEFAULT_VISIBLE_COLUMNS,
  type TenderColumnKey,
} from '@/lib/procurement/tableColumns'

export function useColumnVisibility() {
  const [visibleColumns, setVisibleColumns] = useState<Set<TenderColumnKey>>(
    () => new Set(DEFAULT_VISIBLE_COLUMNS)
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as TenderColumnKey[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleColumns(new Set(parsed))
        }
      }
    } catch {
      /* use defaults */
    }
    setHydrated(true)
  }, [])

  const persist = useCallback((cols: Set<TenderColumnKey>) => {
    try {
      localStorage.setItem(
        COLUMN_VISIBILITY_STORAGE_KEY,
        JSON.stringify(Array.from(cols))
      )
    } catch {
      /* ignore */
    }
  }, [])

  const toggleColumn = useCallback(
    (key: TenderColumnKey) => {
      setVisibleColumns((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          if (next.size <= 3) return prev
          next.delete(key)
        } else {
          next.add(key)
        }
        persist(next)
        return next
      })
    },
    [persist]
  )

  const resetColumns = useCallback(() => {
    const next = new Set(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(next)
    persist(next)
  }, [persist])

  const isVisible = useCallback(
    (key: TenderColumnKey) => visibleColumns.has(key),
    [visibleColumns]
  )

  return { visibleColumns, toggleColumn, resetColumns, isVisible, hydrated }
}
