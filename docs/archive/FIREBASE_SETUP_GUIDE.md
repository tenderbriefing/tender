# 🔥 Firebase Setup Guide for TenderConnect

## 📋 **Step 1: Create Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `tenderconnect` (or your preferred name)
4. Enable Google Analytics (optional)
5. Click "Create project"

## 🔑 **Step 2: Get Firebase Configuration**

1. In your Firebase project, click the gear icon (⚙️) → **Project Settings**
2. Scroll down to "Your apps" section
3. Click **"Add app"** → **Web app** (</> icon)
4. Register app name: `TenderConnect`
5. **Copy the configuration object** - it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBvQ8K9X2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456ghi789jkl"
};
```

## 📝 **Step 3: Create Environment File**

Create a file named `.env.local` in your project root:

```env
# Firebase Configuration (replace with your actual values)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBvQ8K9X2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456ghi789jkl

# Google Calendar API (from your provided credentials)
GOOGLE_CALENDAR_CLIENT_EMAIL=tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com
GOOGLE_CALENDAR_PRIVATE_KEY="YOUR_PRIVATE_KEY_FROM_SERVICE_ACCOUNT_JSON\n"
GOOGLE_CALENDAR_PROJECT_ID=tenderbriefing-472813

# Stripe Configuration (for testing)
STRIPE_PUBLISHABLE_KEY=pk_test_51234567890abcdefghijklmnopqrstuvwxyz
STRIPE_SECRET_KEY=sk_test_51234567890abcdefghijklmnopqrstuvwxyz

# Admin Configuration
ADMIN_EMAIL=admin@tenderconnect.com
```

## 🔧 **Step 4: Enable Firebase Services**

### Authentication
1. Go to **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. Click **Save**

### Firestore Database
1. Go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select a location (choose closest to your users)
5. Click **Done**

### Storage
1. Go to **Storage**
2. Click **Get started**
3. Choose **Start in test mode**
4. Select same location as Firestore
5. Click **Done**

## 🚀 **Step 5: Test the Setup**

```bash
# Restart development server
npm run dev

# Test Firebase connection
npm run test-scraping
```

## 📅 **Google Calendar Integration**

Your Google Calendar credentials will be used to:
- Schedule tender briefing appointments
- Send calendar invites to connectors
- Track briefing attendance
- Manage connector availability

## 🎯 **Next Steps**

1. Create your Firebase project
2. Get the real Firebase configuration
3. Create `.env.local` file with your credentials
4. Enable Firebase services
5. Test the application

---

**Note**: The Google Calendar credentials you provided are perfect for scheduling functionality. We just need to set up Firebase separately for the main application features.
