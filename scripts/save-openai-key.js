const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function saveOpenAIKey() {
  const client = new SecretManagerServiceClient();
  const projectId = process.env.GCP_PROJECT_ID || 'tenderbriefing-34679';
  const secretId = 'openai-api-key';
  const secretValue = process.env.OPENAI_API_KEY;

  if (!secretValue) {
    console.error('Set OPENAI_API_KEY in your environment before running this script.');
    process.exit(1);
  }

  try {
    try {
      await client.getSecret({
        name: `projects/${projectId}/secrets/${secretId}`,
      });
      console.log(`Secret ${secretId} already exists. Adding new version...`);
    } catch (error) {
      if (error.code === 5) {
        console.log(`Creating new secret: ${secretId}`);
        await client.createSecret({
          parent: `projects/${projectId}`,
          secretId,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });
      } else {
        throw error;
      }
    }

    const [version] = await client.addSecretVersion({
      parent: `projects/${projectId}/secrets/${secretId}`,
      payload: {
        data: Buffer.from(secretValue, 'utf8'),
      },
    });

    console.log(`Added secret version: ${version.name}`);
  } catch (error) {
    console.error('Failed to save OpenAI API key:', error.message);
    process.exit(1);
  }
}

saveOpenAIKey();
