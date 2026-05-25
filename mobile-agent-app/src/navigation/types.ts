export type RootStackParamList = {
  Login: undefined
  MainTabs: undefined
  BriefingDetail: { requestId: string }
  CheckIn: { requestId: string; venueLat?: number | null; venueLng?: number | null }
  ReportUpload: { requestId: string; tenderId?: string }
}

export type MainTabParamList = {
  Dispatch: undefined
  Earnings: undefined
  Performance: undefined
  Profile: undefined
}
