/** Firestore document: smeWorkspace/{userId} */
export interface SmeWorkspaceDoc {
  userId: string
  trackedTenderIds: string[]
  savedTenderIds: string[]
  watchedDepartments: string[]
  watchedProvinces: string[]
  updatedAt: string
}

export const emptySmeWorkspace = (userId: string): SmeWorkspaceDoc => ({
  userId,
  trackedTenderIds: [],
  savedTenderIds: [],
  watchedDepartments: [],
  watchedProvinces: [],
  updatedAt: new Date().toISOString(),
})

export interface SmeWorkspaceView {
  workspace: SmeWorkspaceDoc
  trackedTenders: Array<{ id: string; title?: string; tenderNumber?: string; closingDate?: string }>
  savedTenders: Array<{ id: string; title?: string; tenderNumber?: string; closingDate?: string }>
  upcomingBriefings: Array<{
    id: string
    tenderTitle?: string
    briefingDate?: string
    status: string
  }>
  completedReports: number
  closingSoonCount: number
}
