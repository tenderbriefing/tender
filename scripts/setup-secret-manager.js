/**
 * Upload secrets from environment variables into Google Secret Manager.
 * Set values in .env.local (gitignored) or your shell, then run:
 *   node scripts/setup-secret-manager.js
 *
 * Uses Application Default Credentials (gcloud auth application-default login
 * or GOOGLE_APPLICATION_CREDENTIALS pointing at service-account.json).
 */
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const projectId = process.env.GCP_PROJECT_ID || 'tenderbriefing-34679';
const client = new SecretManagerServiceClient();

const secretEnvKeys = {
  'openai-api-key': 'OPENAI_API_KEY',
  'gmail-client-id': 'GMAIL_CLIENT_ID',
  'gmail-client-secret': 'GMAIL_CLIENT_SECRET',
  'firebase-api-key': 'NEXT_PUBLIC_FIREBASE_API_KEY',
  'firebase-auth-domain': 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'firebase-project-id': 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'firebase-storage-bucket': 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'firebase-messaging-sender-id': 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'firebase-app-id': 'NEXT_PUBLIC_FIREBASE_APP_ID',
  'google-maps-api-key': 'GOOGLE_MAPS_API_KEY',
  'admin-email': 'ADMIN_EMAIL',
};

async function createSecret(secretName, secretValue) {
  const parent = `projects/${projectId}`;
  const secretId = secretName;

  try {
    try {
      await client.getSecret({ name: `${parent}/secrets/${secretId}` });
      const [version] = await client.addSecretVersion({
        parent: `${parent}/secrets/${secretId}`,
        payload: { data: Buffer.from(secretValue, 'utf8') },
      });
      console.log(`Updated ${secretName}: ${version.name}`);
      return true;
    } catch (error) {
      if (error.code !== 5) throw error;

      const [secret] = await client.createSecret({
        parent,
        secretId,
        secret: { replication: { automatic: {} } },
      });
      const [version] = await client.addSecretVersion({
        parent: secret.name,
        payload: { data: Buffer.from(secretValue, 'utf8') },
      });
      console.log(`Created ${secretName}: ${version.name}`);
      return true;
    }
  } catch (error) {
    console.error(`Failed ${secretName}:`, error.message);
    return false;
  }
}

async function setupAllSecrets() {
  console.log(`Syncing secrets to project ${projectId}...\n`);
  let ok = 0;
  let skipped = 0;

  for (const [secretName, envKey] of Object.entries(secretEnvKeys)) {
    const value = process.env[envKey];
    if (!value) {
      console.log(`Skip ${secretName} (${envKey} not set)`);
      skipped += 1;
      continue;
    }
    if (await createSecret(secretName, value)) ok += 1;
  }

  console.log(`\nDone: ${ok} synced, ${skipped} skipped (missing env).`);
}

setupAllSecrets().catch((error) => {
  console.error(error);
  process.exit(1);
});
