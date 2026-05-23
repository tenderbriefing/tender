# Firebase Setup Guide for TenderConnect

## 🔥 **Firebase Configuration**

You have the Firebase service account credentials. Here's how to set up the environment variables:

### 1. **Create Environment File**

Create a file named `.env.local` in your project root with the following content:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBvQ8K9X2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tenderbriefing-15d91.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tenderbriefing-15d91
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tenderbriefing-15d91.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=100243959990994273340
NEXT_PUBLIC_FIREBASE_APP_ID=1:100243959990994273340:web:abc123def456ghi789jkl

# Stripe Configuration (for testing)
STRIPE_PUBLISHABLE_KEY=pk_test_51234567890abcdefghijklmnopqrstuvwxyz
STRIPE_SECRET_KEY=sk_test_51234567890abcdefghijklmnopqrstuvwxyz

# Admin Configuration
ADMIN_EMAIL=admin@tenderconnect.com

# Firebase Service Account (for server-side operations)
FIREBASE_SERVICE_ACCOUNT=<paste-json-from-firebase-console-or-use-service-account.json>
```

### 2. **Get Real Firebase API Keys**

The API keys above are placeholders. To get the real ones:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `tenderbriefing-15d91`
3. Go to Project Settings (gear icon)
4. Scroll down to "Your apps"
5. Click "Add app" > Web app
6. Register app with name "TenderConnect"
7. Copy the configuration object and replace the placeholder values

### 3. **Firebase Services Setup**

#### Enable Authentication:
1. Go to Authentication > Sign-in method
2. Enable "Email/Password" provider
3. Optionally enable Google and Facebook providers

#### Create Firestore Database:
1. Go to Firestore Database
2. Click "Create database"
3. Choose "Start in test mode" (we'll update rules later)
4. Select a location close to your users

#### Enable Storage:
1. Go to Storage
2. Click "Get started"
3. Choose "Start in test mode"
4. Select the same location as Firestore

### 4. **Deploy Security Rules**

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage:rules
```

### 5. **Test the Setup**

```bash
# Test the scraping with database
npm run test-scraping

# Start development server
npm run dev
```

### 6. **Initialize Database**

```bash
# Add sample data
npm run init-db
```

## 🚀 **Quick Start Commands**

```bash
# 1. Create .env.local file with the content above
# 2. Install dependencies (already done)
npm install

# 3. Start development server
npm run dev

# 4. Visit http://localhost:3000
```

## 🔧 **Troubleshooting**

### Common Issues:

1. **Environment Variables Not Loading**
   - Make sure `.env.local` is in the project root
   - Restart the development server after adding variables

2. **Firebase Connection Errors**
   - Verify API keys are correct
   - Check Firebase project settings
   - Ensure services are enabled

3. **Module Parse Errors**
   - The Next.js config has been fixed
   - Restart the development server

## 📝 **Next Steps**

1. ✅ Create `.env.local` file
2. ✅ Get real Firebase API keys
3. ✅ Enable Firebase services
4. ✅ Deploy security rules
5. ✅ Test the application
6. ✅ Initialize database with sample data

---

**Your Firebase project ID**: `tenderbriefing-15d91`  
**Service Account**: `firebase-adminsdk-fbsvc@tenderbriefing-15d91.iam.gserviceaccount.com`
