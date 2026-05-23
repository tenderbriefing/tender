const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up TenderConnect Environment Configuration...\n');

const envContent = `# TenderConnect Environment Configuration
# Generated on ${new Date().toISOString()}

# Gmail API Configuration
GMAIL_API_KEY=dbc96530b2529d5442cf5bb059124031635b46a7
GMAIL_CLIENT_ID=YOUR_GMAIL_CLIENT_ID.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=YOUR_GMAIL_CLIENT_SECRET

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tenderbriefing-15d91.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tenderbriefing-15d91
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tenderbriefing-15d91.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=812914997499
NEXT_PUBLIC_FIREBASE_APP_ID=1:812914997499:web:651a2217f574e8be05d85e
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-1GXKBNS6PG

# Google Drive API Key
GOOGLE_DRIVE_API_KEY=dbc96530b2529d5442cf5bb059124031635b46a7

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=tenderbriefing-472813
GOOGLE_CLOUD_STORAGE_BUCKET=tenderbriefing

# Google Maps API Key
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Google Calendar Configuration
GOOGLE_CALENDAR_CLIENT_EMAIL=tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com
GOOGLE_CALENDAR_PRIVATE_KEY="YOUR_PRIVATE_KEY_FROM_SERVICE_ACCOUNT_JSON\\n"
GOOGLE_CALENDAR_PROJECT_ID=tenderbriefing-472813
GOOGLE_CALENDAR_CLIENT_ID=116833974948051371357

# Stripe Configuration (to be filled in)
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_here

# Admin Configuration
ADMIN_EMAIL=support@tenderconnect.com
`;

const envPath = path.join(process.cwd(), '.env.local');

try {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env.local file created successfully!');
  console.log('📧 Gmail API: Configured');
  console.log('🔥 Firebase: Configured');
  console.log('📁 Google Drive: Configured');
  console.log('🗺️  Google Maps: Configured');
  console.log('☁️  Google Cloud Storage: Configured');
  console.log('📅 Google Calendar: Configured');
  console.log('\n🚀 Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Test Gmail: http://localhost:3000/gmail-test');
  console.log('3. Test Drive: http://localhost:3000/drive-test');
  console.log('4. Test Maps: http://localhost:3000/maps-test');
  console.log('5. Test Storage: http://localhost:3000/storage-test');
} catch (error) {
  console.error('❌ Error creating .env.local file:', error.message);
  console.log('\n📝 Please create .env.local manually with the configuration above.');
}
