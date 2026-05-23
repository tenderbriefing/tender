'use client'

import { useCallback, useMemo, useState } from 'react'

export function usePagedList<T>(items: T[], pageSize = 50) {
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  const safePage = Math.min(page, totalPages - 1)

  const slice = useMemo(() => {
    const start = safePage * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const goNext = () => setPage((p) => Math.min(p + 1, totalPages - 1))
  const goPrev = () => setPage((p) => Math.max(p - 1, 0))
  const reset = useCallback(() => setPage(0), [])

  return {
    page: safePage,
    totalPages,
    pageItems: slice,
    total: items.length,
    goNext,
    goPrev,
    reset,
    setPage,
    hasNext: safePage < totalPages - 1,
    hasPrev: safePage > 0,
  }
}
