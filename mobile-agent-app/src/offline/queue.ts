import AsyncStorage from '@react-native-async-storage/async-storage'
import { mobileApi } from '../api/client'

const STORAGE_KEY = 'tb_native_offline_queue_v1'

export type OfflineItemType = 'check_in' | 'check_out' | 'report' | 'upload'

export interface OfflineQueueItem {
  id: string
  itemType: OfflineItemType
  payload: Record<string, unknown>
  createdAt: string
  retries: number
}

async function readQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : []
  } catch {
    return []
  }
}

async function writeQueue(items: OfflineQueueItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export async function enqueueOffline(
  item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retries'>
): Promise<OfflineQueueItem> {
  const queue = await readQueue()
  const entry: OfflineQueueItem = {
    id: `native-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    retries: 0,
    ...item,
  }
  queue.push(entry)
  await writeQueue(queue)
  return entry
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  return readQueue()
}

export async function getPendingCount(): Promise<number> {
  return (await readQueue()).length
}

async function removeOffline(id: string) {
  const queue = await readQueue()
  await writeQueue(queue.filter((q) => q.id !== id))
}

export async function flushOfflineQueue(): Promise<{ synced: number; pending: number }> {
  const queue = await readQueue()
  let synced = 0

  for (const item of queue) {
    try {
      if (item.itemType === 'check_in') {
        await mobileApi.checkIn(item.payload)
      } else if (item.itemType === 'check_out') {
        await mobileApi.checkOut(item.payload)
      } else if (item.itemType === 'report') {
        await mobileApi.submitReport(item.payload)
      } else {
        await mobileApi.offlineEnqueue(item.itemType, item.payload)
      }
      await removeOffline(item.id)
      synced += 1
    } catch {
      /* keep for retry */
    }
  }

  try {
    await mobileApi.offlineProcess()
  } catch {
    /* optional server drain */
  }

  return { synced, pending: (await readQueue()).length }
}
