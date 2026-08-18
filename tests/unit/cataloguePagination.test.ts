import { describe, expect, it } from 'vitest'

describe('catalogue cursor pagination', () => {
  it('does not duplicate ids across consecutive pages and preserves order', () => {
    const items = Array.from({ length: 95 }, (_, i) => ({
      id: `tb-${String(i).padStart(3, '0')}`,
    }))

    const page = (all: typeof items, cursor?: string | null, pageSize = 40) => {
      const start = cursor ? all.findIndex((t) => t.id === cursor) + 1 : 0
      const slice = all.slice(Math.max(0, start), Math.max(0, start) + pageSize)
      const last = slice[slice.length - 1]
      return {
        items: slice,
        nextCursor: slice.length === pageSize && last ? last.id : null,
      }
    }

    const page1 = page(items)
    const page2 = page(items, page1.nextCursor)
    const page3 = page(items, page2.nextCursor)
    const ids = [...page1.items, ...page2.items, ...page3.items].map((t) => t.id)

    expect(page1.items).toHaveLength(40)
    expect(page2.items).toHaveLength(40)
    expect(page3.items).toHaveLength(15)
    expect(page3.nextCursor).toBeNull()
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(items.map((t) => t.id))
  })
})
