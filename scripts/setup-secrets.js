const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();

const projectId = 'tenderbriefing-472813';

// All the secrets we need to create
const secrets = {
  // Firebase Configuration
  'firebase-api-key': 'YOUR_FIREBASE_API_KEY',
  'firebase-auth-domain': 'tenderbriefing-15d91.firebaseapp.com',
  'firebase-project-id': 'tenderbriefing-15d91',
  'firebase-storage-bucket': 'tenderbriefing-15d91.firebasestorage.app',
  'firebase-messaging-sender-id': '812914997499',
  'firebase-app-id': '1:812914997499:web:651a2217f574e8be05d85e',
  'firebase-measurement-id': 'G-1GXKBNS6PG',

  // Google Calendar API
  'google-calendar-client-email': 'tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com',
  'google-calendar-private-key': `YOUR_PRIVATE_KEY_FROM_SERVICE_ACCOUNT_JSON`,
  'google-calendar-project-id': 'tenderbriefing-472813',
  'google-calendar-client-id': '116833974948051371357',

  // Google Maps API
  'google-maps-api-key': 'YOUR_GOOGLE_MAPS_API_KEY',

  // Google Cloud Storage
  'google-cloud-project-id': 'tenderbriefing-472813',
  'google-cloud-storage-bucket': 'tenderbriefing',

  // Google Drive API
  'google-drive-api-key': 'dbc96530b2529d5442cf5bb059124031635b46a7',

  // Gmail API
  'gmail-api-key': 'dbc96530b2529d5442cf5bb059124031635b46a7',
  'gmail-client-id': 'YOUR_GMAIL_CLIENT_ID.apps.googleusercontent.com',
  'gmail-client-secret': 'YOUR_GMAIL_CLIENT_SECRET',

  // eTenders API
  'etenders-api-endpoint': 'https://www.etenders.gov.za/Home/PaginatedTenderOpportunities',
  'etenders-api-headers': JSON.stringify({
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'en',
    'content-type': 'application/json; charset=utf-8',
    'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-requested-with': 'XMLHttpRequest'
  }),

  // Stripe (you'll need to add your actual Stripe keys)
  'stripe-publishable-key': 'pk_test_your_stripe_publishable_key_here',
  'stripe-secret-key': 'sk_test_your_stripe_secret_key_here',

  // Admin email
  'admin-email': 'admin@tenderconnect.co.za'
};

async function createSecret(secretName, secretValue) {
  const parent = `projects/${projectId}`;
  const secretId = secretName;

  try {
    // Check if secret already exists
    try {
      await client.getSecret({ name: `${parent}/secrets/${secretId}` });
      console.log(`Secret ${secretId} already exists, updating...`);
      
      // Add a new version
      const [version] = await client.addSecretVersion({
        parent: `${parent}/secrets/${secretId}`,
        payload: {
          data: Buffer.from(secretValue, 'utf8'),
        },
      });
      console.log(`✅ Updated secret ${secretId}: ${version.name}`);
    } catch (error) {
      if (error.code === 5) { // NOT_FOUND
        // Create the secret
        const [secret] = await client.createSecret({
          parent: parent,
          secretId: secretId,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });

        // Add a version
        const [version] = await client.addSecretVersion({
          parent: secret.name,
          payload: {
            data: Buffer.from(secretValue, 'utf8'),
          },
        });
        console.log(`✅ Created secret ${secretId}: ${version.name}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`❌ Error with secret ${secretId}:`, error.message);
  }
}

async function setupAllSecrets() {
  console.log('🚀 Setting up Google Secret Manager secrets...\n');
  
  for (const [secretName, secretValue] of Object.entries(secrets)) {
    await createSecret(secretName, secretValue);
  }
  
  console.log('\n🎉 All secrets have been set up!');
  console.log('\n📝 Next steps:');
  console.log('1. Update your Stripe keys in Google Secret Manager');
  console.log('2. Test the platform at: https://tenderbriefing-15d91.web.app');
  console.log('3. Set up Firebase Storage manually in the console');
}

setupAllSecrets().catch(console.error);
