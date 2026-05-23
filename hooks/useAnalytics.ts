'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { analyticsService } from '@/lib/services/analyticsService'

export function useAnalytics() {
  const pathname = usePathname()

  // Track page views
  useEffect(() => {
    analyticsService.trackPageView(pathname)
  }, [pathname])

  return {
    trackEvent: analyticsService.trackEvent.bind(analyticsService),
    trackLogin: analyticsService.trackLogin.bind(analyticsService),
    trackSignup: analyticsService.trackSignup.bind(analyticsService),
    trackTenderView: analyticsService.trackTenderView.bind(analyticsService),
    trackBookingCreated: analyticsService.trackBookingCreated.bind(analyticsService),
    trackJobCompleted: analyticsService.trackJobCompleted.bind(analyticsService),
    trackPayment: analyticsService.trackPayment.bind(analyticsService),
    trackSearch: analyticsService.trackSearch.bind(analyticsService),
    trackFileUpload: analyticsService.trackFileUpload.bind(analyticsService),
    trackAIFeatureUsage: analyticsService.trackAIFeatureUsage.bind(analyticsService),
    trackError: analyticsService.trackError.bind(analyticsService),
    trackConversion: analyticsService.trackConversion.bind(analyticsService),
    setUserProperties: analyticsService.setUserProperties.bind(analyticsService),
  }
}
