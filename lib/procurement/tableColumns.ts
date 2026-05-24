import type { TenderSortKey } from './filters'

export type TenderColumnKey =
  | 'tenderNumber'
  | 'description'
  | 'department'
  | 'province'
  | 'category'
  | 'briefingDate'
  | 'closingDate'
  | 'compulsory'
  | 'actions'

export interface TenderColumnDef {
  key: TenderColumnKey
  label: string
  defaultVisible: boolean
  sortKey?: TenderSortKey
  hideOnMobile?: boolean
}

export const TENDER_TABLE_COLUMNS: TenderColumnDef[] = [
  { key: 'tenderNumber', label: 'Tender Number', defaultVisible: true, sortKey: 'tenderNumber' },
  { key: 'description', label: 'Description', defaultVisible: true },
  { key: 'department', label: 'Department', defaultVisible: true, sortKey: 'department' },
  { key: 'province', label: 'Province', defaultVisible: true, sortKey: 'province' },
  { key: 'category', label: 'Category', defaultVisible: true },
  { key: 'briefingDate', label: 'Briefing Date', defaultVisible: true, sortKey: 'briefingDate' },
  { key: 'closingDate', label: 'Closing Date', defaultVisible: true, sortKey: 'closingDate' },
  { key: 'compulsory', label: 'Compulsory Briefing', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true },
]

export const DEFAULT_VISIBLE_COLUMNS: TenderColumnKey[] = TENDER_TABLE_COLUMNS.filter(
  (c) => c.defaultVisible
).map((c) => c.key)

export const COLUMN_VISIBILITY_STORAGE_KEY = 'tenderbriefing-table-columns'
