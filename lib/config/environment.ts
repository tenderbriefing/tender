import { secretManager } from '@/lib/secrets/secretManager';

interface EnvironmentConfig {
  // Gmail API
  gmailApiKey: string;
  gmailClientId: string;
  gmailClientSecret: string;

  // Firebase
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseMessagingSenderId: string;
  firebaseAppId: string;
  firebaseMeasurementId: string;

  // Google Drive
  googleDriveApiKey: string;

  // Google Maps
  googleMapsApiKey: string;

  // Google Cloud Storage
  googleCloudProjectId: string;
  googleCloudStorageBucket: string;

  // Google Calendar
  googleCalendarClientEmail: string;
  googleCalendarPrivateKey: string;
  googleCalendarProjectId: string;
  googleCalendarClientId: string;

  // eTenders API
  etendersApiEndpoint: string;
  etendersApiHeaders: string;

  // Stripe
  stripePublishableKey: string;
  stripeSecretKey: string;

  // Admin
  adminEmail: string;
}

class EnvironmentManager {
  private config: EnvironmentConfig | null = null;
  private loadingPromise: Promise<EnvironmentConfig> | null = null;

  async loadConfig(): Promise<EnvironmentConfig> {
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

  private async _loadConfig(): Promise<EnvironmentConfig> {
    try {
      // Try to load from Secret Manager first
      const secrets = await secretManager.getSecrets([
        'gmail-api-key',
        'gmail-client-id',
        'gmail-client-secret',
        'firebase-api-key',
        'firebase-auth-domain',
        'firebase-project-id',
        'firebase-storage-bucket',
        'firebase-messaging-sender-id',
        'firebase-app-id',
        'firebase-measurement-id',
        'google-drive-api-key',
        'google-maps-api-key',
        'google-cloud-project-id',
        'google-cloud-storage-bucket',
        'google-calendar-client-email',
        'google-calendar-private-key',
        'google-calendar-project-id',
        'google-calendar-client-id',
        'etenders-api-endpoint',
        'etenders-api-headers',
        'stripe-publishable-key',
        'stripe-secret-key',
        'admin-email'
      ]);

      return {
        gmailApiKey: secrets['gmail-api-key'],
        gmailClientId: secrets['gmail-client-id'],
        gmailClientSecret: secrets['gmail-client-secret'],
        firebaseApiKey: secrets['firebase-api-key'],
        firebaseAuthDomain: secrets['firebase-auth-domain'],
        firebaseProjectId: secrets['firebase-project-id'],
        firebaseStorageBucket: secrets['firebase-storage-bucket'],
        firebaseMessagingSenderId: secrets['firebase-messaging-sender-id'],
        firebaseAppId: secrets['firebase-app-id'],
        firebaseMeasurementId: secrets['firebase-measurement-id'],
        googleDriveApiKey: secrets['google-drive-api-key'],
        googleMapsApiKey: secrets['google-maps-api-key'],
        googleCloudProjectId: secrets['google-cloud-project-id'],
        googleCloudStorageBucket: secrets['google-cloud-storage-bucket'],
        googleCalendarClientEmail: secrets['google-calendar-client-email'],
        googleCalendarPrivateKey: secrets['google-calendar-private-key'],
        googleCalendarProjectId: secrets['google-calendar-project-id'],
        googleCalendarClientId: secrets['google-calendar-client-id'],
        etendersApiEndpoint: secrets['etenders-api-endpoint'],
        etendersApiHeaders: secrets['etenders-api-headers'],
        stripePublishableKey: secrets['stripe-publishable-key'],
        stripeSecretKey: secrets['stripe-secret-key'],
        adminEmail: secrets['admin-email']
      };
    } catch (error) {
      console.warn('Failed to load secrets from Secret Manager, falling back to environment variables:', error);
      
      // Fallback to environment variables
      return {
        gmailApiKey: process.env.GMAIL_API_KEY || '',
        gmailClientId: process.env.GMAIL_CLIENT_ID || '',
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET || '',
        firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        firebaseMessagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
        firebaseMeasurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
        googleDriveApiKey: process.env.GOOGLE_DRIVE_API_KEY || '',
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
        googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
        googleCloudStorageBucket: process.env.GOOGLE_CLOUD_STORAGE_BUCKET || '',
        googleCalendarClientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || '',
        googleCalendarPrivateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY || '',
        googleCalendarProjectId: process.env.GOOGLE_CALENDAR_PROJECT_ID || '',
        googleCalendarClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
        etendersApiEndpoint: process.env.ETENDERS_API_ENDPOINT || '',
        etendersApiHeaders: process.env.ETENDERS_API_HEADERS || '',
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
        adminEmail: process.env.ADMIN_EMAIL || ''
      };
    }
  }

  getConfig(): EnvironmentConfig | null {
    return this.config;
  }

  async refreshConfig(): Promise<EnvironmentConfig> {
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

  async getGoogleCalendarConfig() {
    const config = await this.loadConfig();
    return {
      clientEmail: config.googleCalendarClientEmail,
      privateKey: config.googleCalendarPrivateKey,
      projectId: config.googleCalendarProjectId,
      clientId: config.googleCalendarClientId
    };
  }

  async getGoogleMapsConfig() {
    const config = await this.loadConfig();
    return {
      apiKey: config.googleMapsApiKey
    };
  }

  async getGmailConfig() {
    const config = await this.loadConfig();
    return {
      apiKey: config.gmailApiKey,
      clientId: config.gmailClientId,
      clientSecret: config.gmailClientSecret
    };
  }

  async getGoogleDriveConfig() {
    const config = await this.loadConfig();
    return {
      apiKey: config.googleDriveApiKey
    };
  }

  async getGoogleCloudStorageConfig() {
    const config = await this.loadConfig();
    return {
      projectId: config.googleCloudProjectId,
      bucketName: config.googleCloudStorageBucket
    };
  }

  async getETendersConfig() {
    const config = await this.loadConfig();
    return {
      endpoint: config.etendersApiEndpoint,
      headers: JSON.parse(config.etendersApiHeaders || '{}')
    };
  }

  async getStripeConfig() {
    const config = await this.loadConfig();
    return {
      publishableKey: config.stripePublishableKey,
      secretKey: config.stripeSecretKey
    };
  }
}

export const environmentManager = new EnvironmentManager();
