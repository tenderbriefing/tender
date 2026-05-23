// Google Analytics 4 Service
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

export interface AnalyticsEvent {
  action: string
  category: string
  label?: string
  value?: number
  custom_parameters?: { [key: string]: any }
}

export interface UserProperties {
  user_id?: string
  user_type?: 'entrepreneur' | 'connector' | 'admin'
  location?: string
  company_size?: string
  industry?: string
  [key: string]: any
}

class AnalyticsService {
  private measurementId: string
  private isInitialized: boolean = false

  constructor() {
    this.measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''
  }

  isConfigured(): boolean {
    return this.measurementId.length > 0
  }

  /**
   * Initialize Google Analytics
   */
  initialize(): void {
    if (typeof window === 'undefined' || this.isInitialized || !this.measurementId) {
      return
    }

    // Load Google Analytics script
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`
    document.head.appendChild(script)

    // Initialize gtag
    window.dataLayer = window.dataLayer || []
    window.gtag = function() {
      window.dataLayer.push(arguments)
    }

    window.gtag('js', new Date())
    window.gtag('config', this.measurementId, {
      page_title: document.title,
      page_location: window.location.href,
    })

    this.isInitialized = true
  }

  /**
   * Track page view
   */
  trackPageView(pagePath: string, pageTitle?: string): void {
    if (!this.isInitialized) {
      this.initialize()
    }

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', this.measurementId, {
        page_path: pagePath,
        page_title: pageTitle || document.title,
      })
    }
  }

  /**
   * Track custom event
   */
  trackEvent(event: AnalyticsEvent): void {
    if (!this.isInitialized) {
      this.initialize()
    }

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        ...event.custom_parameters,
      })
    }
  }

  /**
   * Track user properties
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.isInitialized) {
      this.initialize()
    }

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', this.measurementId, {
        user_properties: properties,
      })
    }
  }

  /**
   * Track user login
   */
  trackLogin(method: string, userType: string): void {
    this.trackEvent({
      action: 'login',
      category: 'authentication',
      label: method,
      custom_parameters: {
        user_type: userType,
      },
    })
  }

  /**
   * Track user signup
   */
  trackSignup(method: string, userType: string): void {
    this.trackEvent({
      action: 'sign_up',
      category: 'authentication',
      label: method,
      custom_parameters: {
        user_type: userType,
      },
    })
  }

  /**
   * Track tender view
   */
  trackTenderView(tenderId: string, tenderTitle: string): void {
    this.trackEvent({
      action: 'tender_viewed',
      category: 'procurement',
      label: tenderTitle,
      custom_parameters: {
        tender_id: tenderId,
      },
    })
  }

  trackAttendanceRequested(requestId: string, tenderId: string): void {
    this.trackEvent({
      action: 'attendance_requested',
      category: 'procurement',
      custom_parameters: { request_id: requestId, tender_id: tenderId },
    })
  }

  trackAgentAccepted(requestId: string, agentId: string): void {
    this.trackEvent({
      action: 'agent_accepted',
      category: 'procurement',
      custom_parameters: { request_id: requestId, agent_id: agentId },
    })
  }

  trackReportUploaded(requestId: string, reportId: string): void {
    this.trackEvent({
      action: 'report_uploaded',
      category: 'procurement',
      custom_parameters: { request_id: requestId, report_id: reportId },
    })
  }

  /**
   * Track booking creation
   */
  trackBookingCreated(tenderId: string, amount: number): void {
    this.trackEvent({
      action: 'create_booking',
      category: 'booking',
      value: amount,
      custom_parameters: {
        tender_id: tenderId,
        currency: 'ZAR',
      },
    })
  }

  /**
   * Track job completion
   */
  trackJobCompleted(jobId: string, connectorId: string): void {
    this.trackEvent({
      action: 'complete_job',
      category: 'job',
      custom_parameters: {
        job_id: jobId,
        connector_id: connectorId,
      },
    })
  }

  /**
   * Track payment
   */
  trackPayment(amount: number, currency: string = 'ZAR', paymentMethod: string): void {
    this.trackEvent({
      action: 'purchase',
      category: 'ecommerce',
      value: amount,
      custom_parameters: {
        currency,
        payment_method: paymentMethod,
      },
    })
  }

  /**
   * Track search
   */
  trackSearch(searchTerm: string, resultsCount: number): void {
    this.trackEvent({
      action: 'search',
      category: 'engagement',
      label: searchTerm,
      value: resultsCount,
    })
  }

  /**
   * Track file upload
   */
  trackFileUpload(fileType: string, fileSize: number): void {
    this.trackEvent({
      action: 'file_upload',
      category: 'engagement',
      label: fileType,
      value: fileSize,
    })
  }

  /**
   * Track AI feature usage
   */
  trackAIFeatureUsage(feature: string, success: boolean): void {
    this.trackEvent({
      action: 'ai_feature_usage',
      category: 'ai',
      label: feature,
      custom_parameters: {
        success,
      },
    })
  }

  /**
   * Track error
   */
  trackError(error: string, errorCode?: string): void {
    this.trackEvent({
      action: 'error',
      category: 'technical',
      label: error,
      custom_parameters: {
        error_code: errorCode,
      },
    })
  }

  /**
   * Track conversion
   */
  trackConversion(conversionType: string, value?: number): void {
    this.trackEvent({
      action: 'conversion',
      category: 'business',
      label: conversionType,
      value,
    })
  }
}

export const analyticsService = new AnalyticsService()
