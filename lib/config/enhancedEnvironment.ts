import { secretManager } from '@/lib/secrets/secretManager';

interface EnhancedEnvironmentConfig {
  // Firebase (Existing)
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseMessagingSenderId: string;
  firebaseAppId: string;

  // Google Calendar (Existing)
  googleCalendarClientEmail: string;
  googleCalendarPrivateKey: string;
  googleCalendarProjectId: string;
  googleCalendarClientId: string;

  // Payment Processing
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalWebhookId: string;
  payfastMerchantId: string;
  payfastMerchantKey: string;
  payfastPassphrase: string;

  // Communication
  sendgridApiKey: string;
  sendgridFromEmail: string;
  sendgridTemplateIds: string;
  africasTalkingApiKey: string;
  africasTalkingUsername: string;
  africasTalkingSenderId: string;
  whatsappBusinessToken: string;
  whatsappBusinessPhoneNumberId: string;
  whatsappBusinessVerifyToken: string;

  // File Storage & Processing
  awsS3AccessKeyId: string;
  awsS3SecretAccessKey: string;
  awsS3BucketName: string;
  awsS3Region: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  adobePdfServicesClientId: string;
  adobePdfServicesClientSecret: string;

  // Geolocation & Maps
  googleMapsApiKey: string;
  googlePlacesApiKey: string;
  googleGeocodingApiKey: string;
  mapboxAccessToken: string;

  // Analytics & Monitoring
  googleAnalyticsMeasurementId: string;
  googleAnalyticsApiKey: string;
  sentryDsn: string;
  newRelicLicenseKey: string;
  datadogApiKey: string;
  bugsnagApiKey: string;
  rollbarAccessToken: string;

  // Notification Services
  firebaseCloudMessagingServerKey: string;
  onesignalAppId: string;
  onesignalRestApiKey: string;
  pusherAppId: string;
  pusherKey: string;
  pusherSecret: string;
  pusherCluster: string;

  // Government & Tender APIs
  etendersApiKey: string;
  etendersApiSecret: string;
  governmentTenderApiKey: string;
  tedApiKey: string;
  governmentContractsApiKey: string;

  // Business Intelligence
  companiesHouseApiKey: string;
  dunBradstreetApiKey: string;
  creditBureauApiKey: string;
  alphaVantageApiKey: string;
  quandlApiKey: string;

  // AI & Machine Learning
  openaiApiKey: string;
  openaiOrganizationId: string;
  googleAiApiKey: string;
  googleVertexAiProjectId: string;
  googleDocumentAiApiKey: string;
  azureFormRecognizerEndpoint: string;
  azureFormRecognizerKey: string;

  // Identity Verification
  jumioApiToken: string;
  jumioApiSecret: string;
  onfidoApiToken: string;
  homeAffairsApiKey: string;

  // Fraud Prevention
  siftScienceApiKey: string;
  kountMerchantId: string;
  kountApiKey: string;
  experianApiKey: string;
  transunionApiKey: string;

  // Social Media
  linkedinClientId: string;
  linkedinClientSecret: string;
  facebookAppId: string;
  facebookAppSecret: string;
  twitterApiKey: string;
  twitterApiSecret: string;
  twitterBearerToken: string;

  // Mobile Services
  appleAppStoreConnectApiKey: string;
  appleAppStoreConnectIssuerId: string;
  googlePlayConsoleApiKey: string;
  googlePlayConsoleServiceAccount: string;

  // CRM & Business Tools
  salesforceClientId: string;
  salesforceClientSecret: string;
  hubspotApiKey: string;
  asanaApiKey: string;
  trelloApiKey: string;
  mondayApiKey: string;

  // Accounting & Finance
  quickbooksClientId: string;
  quickbooksClientSecret: string;
  xeroClientId: string;
  xeroClientSecret: string;
  standardBankApiKey: string;
  absaApiKey: string;
  fnbApiKey: string;

  // Content & Media
  contentfulSpaceId: string;
  contentfulAccessToken: string;
  strapiApiKey: string;

  // Translation Services
  googleTranslateApiKey: string;
  microsoftTranslatorApiKey: string;
  deeplApiKey: string;

  // Admin
  adminEmail: string;
}

class EnhancedEnvironmentManager {
  private config: EnhancedEnvironmentConfig | null = null;
  private loadingPromise: Promise<EnhancedEnvironmentConfig> | null = null;

  async loadConfig(): Promise<EnhancedEnvironmentConfig> {
    if (this.config) {
      return this.config;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._loadConfig();
    this.config = await this.loadingPromise;
    return this.config;
  }

  private async _loadConfig(): Promise<EnhancedEnvironmentConfig> {
    try {
      // Try to load from Secret Manager first
      const secrets = await secretManager.getSecrets([
        // Firebase
        'firebase-api-key',
        'firebase-auth-domain',
        'firebase-project-id',
        'firebase-storage-bucket',
        'firebase-messaging-sender-id',
        'firebase-app-id',
        
        // Google Calendar
        'google-calendar-client-email',
        'google-calendar-private-key',
        'google-calendar-project-id',
        'google-calendar-client-id',
        
        // Payment Processing
        'stripe-publishable-key',
        'stripe-secret-key',
        'stripe-webhook-secret',
        'paypal-client-id',
        'paypal-client-secret',
        'paypal-webhook-id',
        'payfast-merchant-id',
        'payfast-merchant-key',
        'payfast-passphrase',
        
        // Communication
        'sendgrid-api-key',
        'sendgrid-from-email',
        'sendgrid-template-ids',
        'africas-talking-api-key',
        'africas-talking-username',
        'africas-talking-sender-id',
        'whatsapp-business-token',
        'whatsapp-business-phone-number-id',
        'whatsapp-business-verify-token',
        
        // File Storage & Processing
        'aws-s3-access-key-id',
        'aws-s3-secret-access-key',
        'aws-s3-bucket-name',
        'aws-s3-region',
        'cloudinary-cloud-name',
        'cloudinary-api-key',
        'cloudinary-api-secret',
        'adobe-pdf-services-client-id',
        'adobe-pdf-services-client-secret',
        
        // Maps
        'google-maps-api-key',
        'google-places-api-key',
        'google-geocoding-api-key',
        'mapbox-access-token',
        
        // Analytics
        'google-analytics-measurement-id',
        'google-analytics-api-key',
        'sentry-dsn',
        'new-relic-license-key',
        'datadog-api-key',
        'bugsnag-api-key',
        'rollbar-access-token',
        
        // Notifications
        'firebase-cloud-messaging-server-key',
        'onesignal-app-id',
        'onesignal-rest-api-key',
        'pusher-app-id',
        'pusher-key',
        'pusher-secret',
        'pusher-cluster',
        
        // Government APIs
        'etenders-api-key',
        'etenders-api-secret',
        'government-tender-api-key',
        'ted-api-key',
        'government-contracts-api-key',
        
        // Business Intelligence
        'companies-house-api-key',
        'dun-bradstreet-api-key',
        'credit-bureau-api-key',
        'alpha-vantage-api-key',
        'quandl-api-key',
        
        // AI/ML
        'openai-api-key',
        'openai-organization-id',
        'google-ai-api-key',
        'google-vertex-ai-project-id',
        'google-document-ai-api-key',
        'azure-form-recognizer-endpoint',
        'azure-form-recognizer-key',
        
        // Identity Verification
        'jumio-api-token',
        'jumio-api-secret',
        'onfido-api-token',
        'home-affairs-api-key',
        
        // Fraud Prevention
        'sift-science-api-key',
        'kount-merchant-id',
        'kount-api-key',
        'experian-api-key',
        'transunion-api-key',
        
        // Social Media
        'linkedin-client-id',
        'linkedin-client-secret',
        'facebook-app-id',
        'facebook-app-secret',
        'twitter-api-key',
        'twitter-api-secret',
        'twitter-bearer-token',
        
        // Mobile
        'apple-app-store-connect-api-key',
        'apple-app-store-connect-issuer-id',
        'google-play-console-api-key',
        'google-play-console-service-account',
        
        // CRM
        'salesforce-client-id',
        'salesforce-client-secret',
        'hubspot-api-key',
        'asana-api-key',
        'trello-api-key',
        'monday-api-key',
        
        // Accounting
        'quickbooks-client-id',
        'quickbooks-client-secret',
        'xero-client-id',
        'xero-client-secret',
        'standard-bank-api-key',
        'absa-api-key',
        'fnb-api-key',
        
        // Content
        'contentful-space-id',
        'contentful-access-token',
        'strapi-api-key',
        
        // Translation
        'google-translate-api-key',
        'microsoft-translator-api-key',
        'deepl-api-key',
        
        // Admin
        'admin-email'
      ]);

      return {
        // Firebase
        firebaseApiKey: secrets['firebase-api-key'],
        firebaseAuthDomain: secrets['firebase-auth-domain'],
        firebaseProjectId: secrets['firebase-project-id'],
        firebaseStorageBucket: secrets['firebase-storage-bucket'],
        firebaseMessagingSenderId: secrets['firebase-messaging-sender-id'],
        firebaseAppId: secrets['firebase-app-id'],
        
        // Google Calendar
        googleCalendarClientEmail: secrets['google-calendar-client-email'],
        googleCalendarPrivateKey: secrets['google-calendar-private-key'],
        googleCalendarProjectId: secrets['google-calendar-project-id'],
        googleCalendarClientId: secrets['google-calendar-client-id'],
        
        // Payment Processing
        stripePublishableKey: secrets['stripe-publishable-key'],
        stripeSecretKey: secrets['stripe-secret-key'],
        stripeWebhookSecret: secrets['stripe-webhook-secret'],
        paypalClientId: secrets['paypal-client-id'],
        paypalClientSecret: secrets['paypal-client-secret'],
        paypalWebhookId: secrets['paypal-webhook-id'],
        payfastMerchantId: secrets['payfast-merchant-id'],
        payfastMerchantKey: secrets['payfast-merchant-key'],
        payfastPassphrase: secrets['payfast-passphrase'],
        
        // Communication
        sendgridApiKey: secrets['sendgrid-api-key'],
        sendgridFromEmail: secrets['sendgrid-from-email'],
        sendgridTemplateIds: secrets['sendgrid-template-ids'],
        africasTalkingApiKey: secrets['africas-talking-api-key'],
        africasTalkingUsername: secrets['africas-talking-username'],
        africasTalkingSenderId: secrets['africas-talking-sender-id'],
        whatsappBusinessToken: secrets['whatsapp-business-token'],
        whatsappBusinessPhoneNumberId: secrets['whatsapp-business-phone-number-id'],
        whatsappBusinessVerifyToken: secrets['whatsapp-business-verify-token'],
        
        // File Storage & Processing
        awsS3AccessKeyId: secrets['aws-s3-access-key-id'],
        awsS3SecretAccessKey: secrets['aws-s3-secret-access-key'],
        awsS3BucketName: secrets['aws-s3-bucket-name'],
        awsS3Region: secrets['aws-s3-region'],
        cloudinaryCloudName: secrets['cloudinary-cloud-name'],
        cloudinaryApiKey: secrets['cloudinary-api-key'],
        cloudinaryApiSecret: secrets['cloudinary-api-secret'],
        adobePdfServicesClientId: secrets['adobe-pdf-services-client-id'],
        adobePdfServicesClientSecret: secrets['adobe-pdf-services-client-secret'],
        
        // Maps
        googleMapsApiKey: secrets['google-maps-api-key'],
        googlePlacesApiKey: secrets['google-places-api-key'],
        googleGeocodingApiKey: secrets['google-geocoding-api-key'],
        mapboxAccessToken: secrets['mapbox-access-token'],
        
        // Analytics
        googleAnalyticsMeasurementId: secrets['google-analytics-measurement-id'],
        googleAnalyticsApiKey: secrets['google-analytics-api-key'],
        sentryDsn: secrets['sentry-dsn'],
        newRelicLicenseKey: secrets['new-relic-license-key'],
        datadogApiKey: secrets['datadog-api-key'],
        bugsnagApiKey: secrets['bugsnag-api-key'],
        rollbarAccessToken: secrets['rollbar-access-token'],
        
        // Notifications
        firebaseCloudMessagingServerKey: secrets['firebase-cloud-messaging-server-key'],
        onesignalAppId: secrets['onesignal-app-id'],
        onesignalRestApiKey: secrets['onesignal-rest-api-key'],
        pusherAppId: secrets['pusher-app-id'],
        pusherKey: secrets['pusher-key'],
        pusherSecret: secrets['pusher-secret'],
        pusherCluster: secrets['pusher-cluster'],
        
        // Government APIs
        etendersApiKey: secrets['etenders-api-key'],
        etendersApiSecret: secrets['etenders-api-secret'],
        governmentTenderApiKey: secrets['government-tender-api-key'],
        tedApiKey: secrets['ted-api-key'],
        governmentContractsApiKey: secrets['government-contracts-api-key'],
        
        // Business Intelligence
        companiesHouseApiKey: secrets['companies-house-api-key'],
        dunBradstreetApiKey: secrets['dun-bradstreet-api-key'],
        creditBureauApiKey: secrets['credit-bureau-api-key'],
        alphaVantageApiKey: secrets['alpha-vantage-api-key'],
        quandlApiKey: secrets['quandl-api-key'],
        
        // AI/ML
        openaiApiKey: secrets['openai-api-key'],
        openaiOrganizationId: secrets['openai-organization-id'],
        googleAiApiKey: secrets['google-ai-api-key'],
        googleVertexAiProjectId: secrets['google-vertex-ai-project-id'],
        googleDocumentAiApiKey: secrets['google-document-ai-api-key'],
        azureFormRecognizerEndpoint: secrets['azure-form-recognizer-endpoint'],
        azureFormRecognizerKey: secrets['azure-form-recognizer-key'],
        
        // Identity Verification
        jumioApiToken: secrets['jumio-api-token'],
        jumioApiSecret: secrets['jumio-api-secret'],
        onfidoApiToken: secrets['onfido-api-token'],
        homeAffairsApiKey: secrets['home-affairs-api-key'],
        
        // Fraud Prevention
        siftScienceApiKey: secrets['sift-science-api-key'],
        kountMerchantId: secrets['kount-merchant-id'],
        kountApiKey: secrets['kount-api-key'],
        experianApiKey: secrets['experian-api-key'],
        transunionApiKey: secrets['transunion-api-key'],
        
        // Social Media
        linkedinClientId: secrets['linkedin-client-id'],
        linkedinClientSecret: secrets['linkedin-client-secret'],
        facebookAppId: secrets['facebook-app-id'],
        facebookAppSecret: secrets['facebook-app-secret'],
        twitterApiKey: secrets['twitter-api-key'],
        twitterApiSecret: secrets['twitter-api-secret'],
        twitterBearerToken: secrets['twitter-bearer-token'],
        
        // Mobile
        appleAppStoreConnectApiKey: secrets['apple-app-store-connect-api-key'],
        appleAppStoreConnectIssuerId: secrets['apple-app-store-connect-issuer-id'],
        googlePlayConsoleApiKey: secrets['google-play-console-api-key'],
        googlePlayConsoleServiceAccount: secrets['google-play-console-service-account'],
        
        // CRM
        salesforceClientId: secrets['salesforce-client-id'],
        salesforceClientSecret: secrets['salesforce-client-secret'],
        hubspotApiKey: secrets['hubspot-api-key'],
        asanaApiKey: secrets['asana-api-key'],
        trelloApiKey: secrets['trello-api-key'],
        mondayApiKey: secrets['monday-api-key'],
        
        // Accounting
        quickbooksClientId: secrets['quickbooks-client-id'],
        quickbooksClientSecret: secrets['quickbooks-client-secret'],
        xeroClientId: secrets['xero-client-id'],
        xeroClientSecret: secrets['xero-client-secret'],
        standardBankApiKey: secrets['standard-bank-api-key'],
        absaApiKey: secrets['absa-api-key'],
        fnbApiKey: secrets['fnb-api-key'],
        
        // Content
        contentfulSpaceId: secrets['contentful-space-id'],
        contentfulAccessToken: secrets['contentful-access-token'],
        strapiApiKey: secrets['strapi-api-key'],
        
        // Translation
        googleTranslateApiKey: secrets['google-translate-api-key'],
        microsoftTranslatorApiKey: secrets['microsoft-translator-api-key'],
        deeplApiKey: secrets['deepl-api-key'],
        
        // Admin
        adminEmail: secrets['admin-email']
      };
    } catch (error) {
      console.warn('Failed to load secrets from Secret Manager, falling back to environment variables:', error);
      
      // Fallback to environment variables
      return {
        // Firebase
        firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        firebaseMessagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
        
        // Google Calendar
        googleCalendarClientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || '',
        googleCalendarPrivateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY || '',
        googleCalendarProjectId: process.env.GOOGLE_CALENDAR_PROJECT_ID || '',
        googleCalendarClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
        
        // Payment Processing
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
        paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || '',
        payfastMerchantId: process.env.PAYFAST_MERCHANT_ID || '',
        payfastMerchantKey: process.env.PAYFAST_MERCHANT_KEY || '',
        payfastPassphrase: process.env.PAYFAST_PASSPHRASE || '',
        
        // Communication
        sendgridApiKey: process.env.SENDGRID_API_KEY || '',
        sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || '',
        sendgridTemplateIds: process.env.SENDGRID_TEMPLATE_IDS || '',
        africasTalkingApiKey: process.env.AFRICAS_TALKING_API_KEY || '',
        africasTalkingUsername: process.env.AFRICAS_TALKING_USERNAME || '',
        africasTalkingSenderId: process.env.AFRICAS_TALKING_SENDER_ID || '',
        whatsappBusinessToken: process.env.WHATSAPP_BUSINESS_TOKEN || '',
        whatsappBusinessPhoneNumberId: process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID || '',
        whatsappBusinessVerifyToken: process.env.WHATSAPP_BUSINESS_VERIFY_TOKEN || '',
        
        // File Storage & Processing
        awsS3AccessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || '',
        awsS3SecretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || '',
        awsS3BucketName: process.env.AWS_S3_BUCKET_NAME || '',
        awsS3Region: process.env.AWS_S3_REGION || '',
        cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
        cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
        adobePdfServicesClientId: process.env.ADOBE_PDF_SERVICES_CLIENT_ID || '',
        adobePdfServicesClientSecret: process.env.ADOBE_PDF_SERVICES_CLIENT_SECRET || '',
        
        // Maps
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
        googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
        googleGeocodingApiKey: process.env.GOOGLE_GEOCODING_API_KEY || '',
        mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN || '',
        
        // Analytics
        googleAnalyticsMeasurementId: process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID || '',
        googleAnalyticsApiKey: process.env.GOOGLE_ANALYTICS_API_KEY || '',
        sentryDsn: process.env.SENTRY_DSN || '',
        newRelicLicenseKey: process.env.NEW_RELIC_LICENSE_KEY || '',
        datadogApiKey: process.env.DATADOG_API_KEY || '',
        bugsnagApiKey: process.env.BUGSNAG_API_KEY || '',
        rollbarAccessToken: process.env.ROLLBAR_ACCESS_TOKEN || '',
        
        // Notifications
        firebaseCloudMessagingServerKey: process.env.FIREBASE_CLOUD_MESSAGING_SERVER_KEY || '',
        onesignalAppId: process.env.ONESIGNAL_APP_ID || '',
        onesignalRestApiKey: process.env.ONESIGNAL_REST_API_KEY || '',
        pusherAppId: process.env.PUSHER_APP_ID || '',
        pusherKey: process.env.PUSHER_KEY || '',
        pusherSecret: process.env.PUSHER_SECRET || '',
        pusherCluster: process.env.PUSHER_CLUSTER || '',
        
        // Government APIs
        etendersApiKey: process.env.ETENDERS_API_KEY || '',
        etendersApiSecret: process.env.ETENDERS_API_SECRET || '',
        governmentTenderApiKey: process.env.GOVERNMENT_TENDER_API_KEY || '',
        tedApiKey: process.env.TED_API_KEY || '',
        governmentContractsApiKey: process.env.GOVERNMENT_CONTRACTS_API_KEY || '',
        
        // Business Intelligence
        companiesHouseApiKey: process.env.COMPANIES_HOUSE_API_KEY || '',
        dunBradstreetApiKey: process.env.DUN_BRADSTREET_API_KEY || '',
        creditBureauApiKey: process.env.CREDIT_BUREAU_API_KEY || '',
        alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
        quandlApiKey: process.env.QUANDL_API_KEY || '',
        
        // AI/ML
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        openaiOrganizationId: process.env.OPENAI_ORGANIZATION_ID || '',
        googleAiApiKey: process.env.GOOGLE_AI_API_KEY || '',
        googleVertexAiProjectId: process.env.GOOGLE_VERTEX_AI_PROJECT_ID || '',
        googleDocumentAiApiKey: process.env.GOOGLE_DOCUMENT_AI_API_KEY || '',
        azureFormRecognizerEndpoint: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT || '',
        azureFormRecognizerKey: process.env.AZURE_FORM_RECOGNIZER_KEY || '',
        
        // Identity Verification
        jumioApiToken: process.env.JUMIO_API_TOKEN || '',
        jumioApiSecret: process.env.JUMIO_API_SECRET || '',
        onfidoApiToken: process.env.ONFIDO_API_TOKEN || '',
        homeAffairsApiKey: process.env.HOME_AFFAIRS_API_KEY || '',
        
        // Fraud Prevention
        siftScienceApiKey: process.env.SIFT_SCIENCE_API_KEY || '',
        kountMerchantId: process.env.KOUNT_MERCHANT_ID || '',
        kountApiKey: process.env.KOUNT_API_KEY || '',
        experianApiKey: process.env.EXPERIAN_API_KEY || '',
        transunionApiKey: process.env.TRANSUNION_API_KEY || '',
        
        // Social Media
        linkedinClientId: process.env.LINKEDIN_CLIENT_ID || '',
        linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
        facebookAppId: process.env.FACEBOOK_APP_ID || '',
        facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
        twitterApiKey: process.env.TWITTER_API_KEY || '',
        twitterApiSecret: process.env.TWITTER_API_SECRET || '',
        twitterBearerToken: process.env.TWITTER_BEARER_TOKEN || '',
        
        // Mobile
        appleAppStoreConnectApiKey: process.env.APPLE_APP_STORE_CONNECT_API_KEY || '',
        appleAppStoreConnectIssuerId: process.env.APPLE_APP_STORE_CONNECT_ISSUER_ID || '',
        googlePlayConsoleApiKey: process.env.GOOGLE_PLAY_CONSOLE_API_KEY || '',
        googlePlayConsoleServiceAccount: process.env.GOOGLE_PLAY_CONSOLE_SERVICE_ACCOUNT || '',
        
        // CRM
        salesforceClientId: process.env.SALESFORCE_CLIENT_ID || '',
        salesforceClientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
        hubspotApiKey: process.env.HUBSPOT_API_KEY || '',
        asanaApiKey: process.env.ASANA_API_KEY || '',
        trelloApiKey: process.env.TRELLO_API_KEY || '',
        mondayApiKey: process.env.MONDAY_API_KEY || '',
        
        // Accounting
        quickbooksClientId: process.env.QUICKBOOKS_CLIENT_ID || '',
        quickbooksClientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
        xeroClientId: process.env.XERO_CLIENT_ID || '',
        xeroClientSecret: process.env.XERO_CLIENT_SECRET || '',
        standardBankApiKey: process.env.STANDARD_BANK_API_KEY || '',
        absaApiKey: process.env.ABSA_API_KEY || '',
        fnbApiKey: process.env.FNB_API_KEY || '',
        
        // Content
        contentfulSpaceId: process.env.CONTENTFUL_SPACE_ID || '',
        contentfulAccessToken: process.env.CONTENTFUL_ACCESS_TOKEN || '',
        strapiApiKey: process.env.STRAPI_API_KEY || '',
        
        // Translation
        googleTranslateApiKey: process.env.GOOGLE_TRANSLATE_API_KEY || '',
        microsoftTranslatorApiKey: process.env.MICROSOFT_TRANSLATOR_API_KEY || '',
        deeplApiKey: process.env.DEEPL_API_KEY || '',
        
        // Admin
        adminEmail: process.env.ADMIN_EMAIL || ''
      };
    }
  }

  getConfig(): EnhancedEnvironmentConfig | null {
    return this.config;
  }

  async refreshConfig(): Promise<EnhancedEnvironmentConfig> {
    this.config = null;
    this.loadingPromise = null;
    return this.loadConfig();
  }

  // Helper methods for specific configurations
  async getFirebaseConfig() {
    const config = await this.loadConfig();
    return {
      apiKey: config.firebaseApiKey,
      authDomain: config.firebaseAuthDomain,
      projectId: config.firebaseProjectId,
      storageBucket: config.firebaseStorageBucket,
      messagingSenderId: config.firebaseMessagingSenderId,
      appId: config.firebaseAppId
    };
  }

  async getPaymentConfig() {
    const config = await this.loadConfig();
    return {
      stripe: {
        publishableKey: config.stripePublishableKey,
        secretKey: config.stripeSecretKey,
        webhookSecret: config.stripeWebhookSecret
      },
      paypal: {
        clientId: config.paypalClientId,
        clientSecret: config.paypalClientSecret,
        webhookId: config.paypalWebhookId
      },
      payfast: {
        merchantId: config.payfastMerchantId,
        merchantKey: config.payfastMerchantKey,
        passphrase: config.payfastPassphrase
      }
    };
  }

  async getCommunicationConfig() {
    const config = await this.loadConfig();
    return {
      email: {
        sendgridApiKey: config.sendgridApiKey,
        fromEmail: config.sendgridFromEmail,
        templateIds: config.sendgridTemplateIds
      },
      sms: {
        africasTalkingApiKey: config.africasTalkingApiKey,
        username: config.africasTalkingUsername,
        senderId: config.africasTalkingSenderId
      },
      whatsapp: {
        businessToken: config.whatsappBusinessToken,
        phoneNumberId: config.whatsappBusinessPhoneNumberId,
        verifyToken: config.whatsappBusinessVerifyToken
      }
    };
  }

  async getMapsConfig() {
    const config = await this.loadConfig();
    return {
      google: {
        mapsApiKey: config.googleMapsApiKey,
        placesApiKey: config.googlePlacesApiKey,
        geocodingApiKey: config.googleGeocodingApiKey
      },
      mapbox: {
        accessToken: config.mapboxAccessToken
      }
    };
  }

  async getAiConfig() {
    const config = await this.loadConfig();
    return {
      openai: {
        apiKey: config.openaiApiKey,
        organizationId: config.openaiOrganizationId
      },
      google: {
        aiApiKey: config.googleAiApiKey,
        vertexAiProjectId: config.googleVertexAiProjectId,
        documentAiApiKey: config.googleDocumentAiApiKey
      },
      azure: {
        formRecognizerEndpoint: config.azureFormRecognizerEndpoint,
        formRecognizerKey: config.azureFormRecognizerKey
      }
    };
  }
}

export const enhancedEnvironmentManager = new EnhancedEnvironmentManager();
