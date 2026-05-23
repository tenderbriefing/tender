import type {
  AgentAssignmentService,
  AuditLogService,
  CalendarService,
  IncrementalSyncService,
  StorageAdapter,
  StorageAdapterModule,
  UsersService,
} from './types'

/* eslint-disable @typescript-eslint/no-require-imports */
function loadStorageAdapter(): StorageAdapterModule {
  return require('../../backend/services/storageAdapter.js')
}

function loadIncrementalSync(): IncrementalSyncService {
  return require('../../backend/services/incrementalSyncService.js')
}

function loadAgentAssignment(): AgentAssignmentService {
  return require('../../backend/services/agentAssignmentService.js')
}

function loadAuditLog(): AuditLogService {
  return require('../../backend/services/auditLogService.js')
}

function loadCalendar(): CalendarService {
  return require('../../backend/services/calendarService.js')
}

function loadUsers(): UsersService {
  return require('../../backend/services/usersService.js')
}
/* eslint-enable @typescript-eslint/no-require-imports */

export function loadBackendService<T = Record<string, unknown>>(
  serviceName: string
): T {
  switch (serviceName) {
    case 'storageAdapter':
      return loadStorageAdapter() as T
    case 'incrementalSyncService':
      return loadIncrementalSync() as T
    case 'agentAssignmentService':
      return loadAgentAssignment() as T
    case 'auditLogService':
      return loadAuditLog() as T
    case 'calendarService':
      return loadCalendar() as T
    case 'tenderPipeline':
      return require('../../backend/services/tenderPipeline.js') as T
    case 'firebaseAdmin':
      return require('../../backend/config/firebaseAdmin.js') as T
    default:
      throw new Error(`Unknown backend service: ${serviceName}`)
  }
}

export const backend = {
  loadBackendService,
  getStorage: (): StorageAdapter => loadStorageAdapter().getStorage(),
  incrementalSync: (): IncrementalSyncService => loadIncrementalSync(),
  agentAssignment: (): AgentAssignmentService => loadAgentAssignment(),
  auditLog: (): AuditLogService => loadAuditLog(),
  calendar: (): CalendarService => loadCalendar(),
  tenderPipeline: () => loadBackendService('tenderPipeline'),
  users: (): UsersService => loadUsers(),
}
