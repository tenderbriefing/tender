export type WelcomeEmailRole = 'sme' | 'youth-agent'

export type WelcomeEmailInput = {
  to: string
  displayName: string
  userType: WelcomeEmailRole
  companyName?: string
  uid?: string
}

export type WelcomeEmailResult = {
  sent: boolean
  skipped?: boolean
  error?: string
  id?: string
}
