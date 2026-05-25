const STORAGE_KEY = 'tb_agent_offline_queue_v1'

export type OfflineItemType = 'check_in' | 'check_out' | 'report' | 'upload' | 'voice' | 'telemetry'

export interface OfflineQueueItem {
  id: string
  itemType: OfflineItemType
  payload: Record<string, unknown>
  createdAt: string
  retries: number
}

function readQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : []
  } catch {
    return []
  }
}

function writeQueue(items: OfflineQueueItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function enqueueOffline(item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retries'>) {
  const queue = readQueue()
  const entry: OfflineQueueItem = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    retries: 0,
    ...item,
  }
  queue.push(entry)
  writeQueue(queue)
  return entry
}

export function getOfflineQueue() {
  return readQueue()
}

export function removeOffline(id: string) {
  writeQueue(readQueue().filter((q) => q.id !== id))
}

export function clearOffline() {
  writeQueue([])
}
