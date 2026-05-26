/**
 * @deprecated Use `@/components/sme/SmeCategoryCommoditySelector` instead.
 * Legacy wrapper for older imports.
 */
'use client'

import SmeCategoryCommoditySelector from '@/components/sme/SmeCategoryCommoditySelector'

interface LegacyProps {
  selectedCategories: string[]
  onSelectionChange: (categories: string[]) => void
  maxSelections?: number
}

export default function CategorySelection({
  selectedCategories,
  onSelectionChange,
}: LegacyProps) {
  return (
    <SmeCategoryCommoditySelector
      value={{ categories: selectedCategories, commodities: [] }}
      onChange={({ categories }) => onSelectionChange(categories)}
      showFreeModelBanner
    />
  )
}

export { CategorySelection }
