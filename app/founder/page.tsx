'use client'

import FounderOverviewPage from '@/components/founder/v2/OverviewPage'
import LegacyFounderHomePage from '@/components/founder/legacy/FounderHomePage'
import { isFounderDashboardV2EnabledClient } from '@/lib/founder/access'

export default function FounderHomePage() {
  if (!isFounderDashboardV2EnabledClient()) {
    return <LegacyFounderHomePage />
  }
  return <FounderOverviewPage />
}
