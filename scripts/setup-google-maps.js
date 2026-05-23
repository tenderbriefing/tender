const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Your Google Maps API key
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
const PROJECT_ID = 'tenderbriefing-472813';

async function setupGoogleMapsSecret() {
  const client = new SecretManagerServiceClient();

  try {
    console.log('🔧 Setting up Google Maps API key in Secret Manager...');
    console.log(`📋 Project ID: ${PROJECT_ID}`);
    console.log(`🗝️  API Key: ${GOOGLE_MAPS_API_KEY.substring(0, 20)}...`);

    // Create the secret
    const [secret] = await client.createSecret({
      parent: `projects/${PROJECT_ID}`,
      secretId: 'google-maps-api-key',
      secret: {
        replication: {
          automatic: {},
        },
      },
    });

    console.log('✅ Secret created:', secret.name);

    // Add the secret version
    const [version] = await client.addSecretVersion({
      parent: secret.name,
      payload: {
        data: Buffer.from(GOOGLE_MAPS_API_KEY, 'utf8'),
      },
    });

    console.log('✅ Secret version added:', version.name);
    console.log('🎉 Google Maps API key successfully stored in Secret Manager!');

    // Test the secret retrieval
    const [testVersion] = await client.accessSecretVersion({
      name: `${secret.name}/versions/latest`,
    });

    const retrievedKey = testVersion.payload?.data?.toString();
    if (retrievedKey === GOOGLE_MAPS_API_KEY) {
      console.log('✅ Secret retrieval test passed!');
    } else {
      console.log('❌ Secret retrieval test failed!');
    }

    console.log('\n📝 Next steps:');
    console.log('1. Visit http://localhost:3000/maps-test to test the integration');
    console.log('2. The API key is now securely stored in Google Secret Manager');
    console.log('3. Your application will automatically use this key for Maps services');

  } catch (error) {
    if (error.code === 6) {
      console.log('ℹ️  Secret already exists. Updating with new version...');
      
      // Update existing secret
      const [version] = await client.addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/google-maps-api-key`,
        payload: {
          data: Buffer.from(GOOGLE_MAPS_API_KEY, 'utf8'),
        },
      });

      console.log('✅ Secret updated:', version.name);
      console.log('🎉 Google Maps API key successfully updated in Secret Manager!');
    } else {
      console.error('❌ Error setting up Google Maps secret:', error);
      throw error;
    }
  }
}

// Run the setup
setupGoogleMapsSecret()
  .then(() => {
    console.log('\n🚀 Google Maps integration setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  });
