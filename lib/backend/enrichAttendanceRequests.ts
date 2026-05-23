import { backend } from './loadServices'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enrichAttendanceRequests: enrich } = require('../../backend/utils/enrichAttendanceRequests')

export async function enrichAttendanceRequests<T extends { tenderId?: string }>(
  requests: T[]
) {
  return enrich(backend.getStorage(), requests)
}
