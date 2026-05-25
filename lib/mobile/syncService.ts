'use client'

import { mobilePost } from './mobileApi'
import {
  enqueueOffline,
  getOfflineQueue,
  removeOffline,
  type OfflineQueueItem,
} from './offlineStore'
import { trackMobileEvent } from './telemetry'

export async function flushOfflineQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, pending: getOfflineQueue().length }
  }

  const queue = getOfflineQueue()
  let synced = 0

  for (const item of queue) {
    try {
      if (item.itemType === 'check_in' || item.itemType === 'check_out') {
        await mobilePost(`/api/mobile/v1/${item.itemType.replace('_', '-')}`, item.payload)
      } else if (item.itemType === 'telemetry') {
        await mobilePost('/api/mobile/v1/telemetry', item.payload)
      } else {
        await mobilePost('/api/mobile/v1/sync', {
          enqueue: {
            itemType: item.itemType,
            payload: item.payload,
            clientTimestamp: item.createdAt,
          },
        })
      }
      removeOffline(item.id)
      synced += 1
    } catch {
      /* keep in queue */
    }
  }

  try {
    await mobilePost('/api/mobile/v1/sync', {})
  } catch {
    /* server queue optional */
  }

  if (synced > 0) {
    await trackMobileEvent('offline_sync', { synced, remaining: getOfflineQueue().length })
  }

  return { synced, pending: getOfflineQueue().length }
}

export function queueWhenOffline(item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retries'>) {
  return enqueueOffline(item)
}
