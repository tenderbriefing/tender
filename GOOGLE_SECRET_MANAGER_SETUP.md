# 🔐 Google Secret Manager Setup for TenderConnect

## 📋 **Overview**

Google Secret Manager will securely store your sensitive configuration like:
- Firebase API keys
- Google Calendar credentials
- Stripe API keys
- Database connection strings
- Other sensitive environment variables

## 🚀 **Step 1: Enable Secret Manager API**

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/apis/library?project=tenderbriefing-472813
   - Search for "Secret Manager API"
   - Click on it and press "Enable"

2. **Alternative Method**:
   - Go to: https://console.cloud.google.com/security/secret-manager?project=tenderbriefing-472813
   - If prompted, enable the Secret Manager API

## 🔑 **Step 2: Create Secrets**

From the Secret Manager page, create these secrets:

### Firebase Configuration
```bash
# Secret Name: firebase-api-key
# Value: Your actual Firebase API key

# Secret Name: firebase-auth-domain
# Value: tenderbriefing-15d91.firebaseapp.com

# Secret Name: firebase-project-id
# Value: tenderbriefing-15d91

# Secret Name: firebase-storage-bucket
# Value: tenderbriefing-15d91.appspot.com

# Secret Name: firebase-messaging-sender-id
# Value: Your actual messaging sender ID

# Secret Name: firebase-app-id
# Value: Your actual Firebase app ID
```

### Google Calendar Configuration
```bash
# Secret Name: google-calendar-client-email
# Value: tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com

# Secret Name: google-calendar-private-key
# Value: Your complete private key (including BEGIN/END markers)

# Secret Name: google-calendar-project-id
# Value: tenderbriefing-472813

# Secret Name: google-calendar-client-id
# Value: 116833974948051371357
```

### Stripe Configuration
```bash
# Secret Name: stripe-publishable-key
# Value: Your Stripe publishable key

# Secret Name: stripe-secret-key
# Value: Your Stripe secret key
```

### Admin Configuration
```bash
# Secret Name: admin-email
# Value: admin@tenderconnect.com
```

## 🔧 **Step 3: Install Secret Manager Client**

```bash
npm install @google-cloud/secret-manager
```

## 📝 **Step 4: Create Secret Manager Service**

Create a service to manage secrets:

```typescript
// lib/secrets/secretManager.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

class SecretManagerService {
  private client: SecretManagerServiceClient;
  private projectId: string;

  constructor() {
    this.client = new SecretManagerServiceClient();
    this.projectId = 'tenderbriefing-472813';
  }

  async getSecret(secretName: string): Promise<string> {
    try {
      const [version] = await this.client.accessSecretVersion({
        name: `projects/${this.projectId}/secrets/${secretName}/versions/latest`,
      });

      const secretValue = version.payload?.data?.toString();
      if (!secretValue) {
        throw new Error(`Secret ${secretName} not found or empty`);
      }

      return secretValue;
    } catch (error) {
      console.error(`Error accessing secret ${secretName}:`, error);
      throw error;
    }
  }

  async getSecrets(secretNames: string[]): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {};
    
    await Promise.all(
      secretNames.map(async (secretName) => {
        try {
          secrets[secretName] = await this.getSecret(secretName);
        } catch (error) {
          console.error(`Failed to get secret ${secretName}:`, error);
          // Use environment variable as fallback
          secrets[secretName] = process.env[secretName.toUpperCase().replace(/-/g, '_')] || '';
        }
      })
    );

    return secrets;
  }
}

export const secretManager = new SecretManagerService();
```

## 🔄 **Step 5: Update Environment Configuration**

Create a new environment loader:

```typescript
// lib/config/environment.ts
import { secretManager } from '@/lib/secrets/secretManager';

interface EnvironmentConfig {
  // Firebase
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseMessagingSenderId: string;
  firebaseAppId: string;

  // Google Calendar
  googleCalendarClientEmail: string;
  googleCalendarPrivateKey: string;
  googleCalendarProjectId: string;
  googleCalendarClientId: string;

  // Stripe
  stripePublishableKey: string;
  stripeSecretKey: string;

  // Admin
  adminEmail: string;
}

class EnvironmentManager {
  private config: EnvironmentConfig | null = null;

  async loadConfig(): Promise<EnvironmentConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      // Try to load from Secret Manager first
      const secrets = await secretManager.getSecrets([
        'firebase-api-key',
        'firebase-auth-domain',
        'firebase-project-id',
        'firebase-storage-bucket',
        'firebase-messaging-sender-id',
        'firebase-app-id',
        'google-calendar-client-email',
        'google-calendar-private-key',
        'google-calendar-project-id',
        'google-calendar-client-id',
        'stripe-publishable-key',
        'stripe-secret-key',
        'admin-email'
      ]);

      this.config = {
        firebaseApiKey: secrets['firebase-api-key'],
        firebaseAuthDomain: secrets['firebase-auth-domain'],
        firebaseProjectId: secrets['firebase-project-id'],
        firebaseStorageBucket: secrets['firebase-storage-bucket'],
        firebaseMessagingSenderId: secrets['firebase-messaging-sender-id'],
        firebaseAppId: secrets['firebase-app-id'],
        googleCalendarClientEmail: secrets['google-calendar-client-email'],
        googleCalendarPrivateKey: secrets['google-calendar-private-key'],
        googleCalendarProjectId: secrets['google-calendar-project-id'],
        googleCalendarClientId: secrets['google-calendar-client-id'],
        stripePublishableKey: secrets['stripe-publishable-key'],
        stripeSecretKey: secrets['stripe-secret-key'],
        adminEmail: secrets['admin-email']
      };
    } catch (error) {
      console.warn('Failed to load secrets from Secret Manager, falling back to environment variables:', error);
      
      // Fallback to environment variables
      this.config = {
        firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        firebaseMessagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
        googleCalendarClientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || '',
        googleCalendarPrivateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY || '',
        googleCalendarProjectId: process.env.GOOGLE_CALENDAR_PROJECT_ID || '',
        googleCalendarClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
        adminEmail: process.env.ADMIN_EMAIL || ''
      };
    }

    return this.config;
  }

  getConfig(): EnvironmentConfig | null {
    return this.config;
  }
}

export const environmentManager = new EnvironmentManager();
```

## 🔐 **Step 6: Update Firebase Configuration**

Update your Firebase configuration to use Secret Manager:

```typescript
// lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { environmentManager } from '@/lib/config/environment';

let app: any = null;

export const initializeFirebase = async () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const config = await environmentManager.loadConfig();

  const firebaseConfig = {
    apiKey: config.firebaseApiKey,
    authDomain: config.firebaseAuthDomain,
    projectId: config.firebaseProjectId,
    storageBucket: config.firebaseStorageBucket,
    messagingSenderId: config.firebaseMessagingSenderId,
    appId: config.firebaseAppId
  };

  app = initializeApp(firebaseConfig);
  return app;
};

export const getFirebaseApp = () => app;

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();
```

## 🚀 **Step 7: Update Google Calendar Service**

Update your Google Calendar service to use Secret Manager:

```typescript
// lib/calendar/googleCalendar.ts
import { google } from 'googleapis';
import { environmentManager } from '@/lib/config/environment';

class GoogleCalendarService {
  private calendar: any;
  private calendarId: string;

  constructor() {
    this.calendarId = 'primary';
    this.initializeCalendar();
  }

  private async initializeCalendar() {
    try {
      const config = await environmentManager.loadConfig();
      
      const auth = new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: config.googleCalendarProjectId,
          private_key_id: 'dbc96530b2529d5442cf5bb059124031635b46a7',
          private_key: config.googleCalendarPrivateKey.replace(/\\n/g, '\n'),
          client_email: config.googleCalendarClientEmail,
          client_id: config.googleCalendarClientId,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(config.googleCalendarClientEmail)}`,
          universe_domain: 'googleapis.com'
        },
        scopes: ['https://www.googleapis.com/auth/calendar']
      });

      this.calendar = google.calendar({ version: 'v3', auth });
    } catch (error) {
      console.error('Failed to initialize Google Calendar:', error);
      throw new Error('Google Calendar initialization failed');
    }
  }

  // ... rest of your existing methods
}

export const googleCalendarService = new GoogleCalendarService();
```

## 🔧 **Step 7: Set Up IAM Permissions**

1. **Go to IAM & Admin**:
   - Visit: https://console.cloud.google.com/iam-admin/iam?project=tenderbriefing-472813

2. **Add Service Account Permissions**:
   - Find your service account: `tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com`
   - Add these roles:
     - `Secret Manager Secret Accessor`
     - `Secret Manager Viewer`

## 📝 **Step 8: Create Environment File (Fallback)**

Create `.env.local` as a fallback:

```env
# Fallback environment variables (used if Secret Manager fails)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tenderbriefing-15d91.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tenderbriefing-15d91
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tenderbriefing-15d91.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id_here

GOOGLE_CALENDAR_CLIENT_EMAIL=tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com
GOOGLE_CALENDAR_PRIVATE_KEY="YOUR_PRIVATE_KEY_FROM_SERVICE_ACCOUNT_JSON\n"
GOOGLE_CALENDAR_PROJECT_ID=tenderbriefing-472813
GOOGLE_CALENDAR_CLIENT_ID=116833974948051371357

STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_here

ADMIN_EMAIL=admin@tenderconnect.com
```

## 🚀 **Step 9: Test the Setup**

```bash
# Install the Secret Manager client
npm install @google-cloud/secret-manager

# Test the setup
npm run dev
```

## 🔗 **Quick Links**

- **Secret Manager Console**: https://console.cloud.google.com/security/secret-manager?project=tenderbriefing-472813
- **IAM & Admin**: https://console.cloud.google.com/iam-admin/iam?project=tenderbriefing-472813
- **APIs & Services**: https://console.cloud.google.com/apis/library?project=tenderbriefing-472813

## 🎯 **Benefits of Secret Manager**

1. **Security**: Secrets are encrypted at rest and in transit
2. **Access Control**: Fine-grained IAM permissions
3. **Audit Logging**: Track who accessed what secrets
4. **Versioning**: Keep track of secret versions
5. **Rotation**: Easy secret rotation capabilities
6. **Integration**: Works seamlessly with Google Cloud services

---

**Your TenderConnect platform will now use Google Secret Manager for secure configuration management!** 🔐
