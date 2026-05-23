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
          const envKey = secretName.toUpperCase().replace(/-/g, '_');
          secrets[secretName] = process.env[envKey] || '';
        }
      })
    );

    return secrets;
  }

  async createSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      // Create the secret
      await this.client.createSecret({
        parent: `projects/${this.projectId}`,
        secretId: secretName,
        secret: {
          replication: {
            automatic: {},
          },
        },
      });

      // Add the secret version
      await this.client.addSecretVersion({
        parent: `projects/${this.projectId}/secrets/${secretName}`,
        payload: {
          data: Buffer.from(secretValue, 'utf8'),
        },
      });

      console.log(`Secret ${secretName} created successfully`);
    } catch (error) {
      console.error(`Error creating secret ${secretName}:`, error);
      throw error;
    }
  }

  async updateSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      await this.client.addSecretVersion({
        parent: `projects/${this.projectId}/secrets/${secretName}`,
        payload: {
          data: Buffer.from(secretValue, 'utf8'),
        },
      });

      console.log(`Secret ${secretName} updated successfully`);
    } catch (error) {
      console.error(`Error updating secret ${secretName}:`, error);
      throw error;
    }
  }

  async deleteSecret(secretName: string): Promise<void> {
    try {
      await this.client.deleteSecret({
        name: `projects/${this.projectId}/secrets/${secretName}`,
      });

      console.log(`Secret ${secretName} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting secret ${secretName}:`, error);
      throw error;
    }
  }

  async listSecrets(): Promise<string[]> {
    try {
      const [secrets] = await this.client.listSecrets({
        parent: `projects/${this.projectId}`,
      });

      return secrets.map(secret => {
        const name = secret.name || '';
        return name.split('/').pop() || '';
      });
    } catch (error) {
      console.error('Error listing secrets:', error);
      throw error;
    }
  }
}

export const secretManager = new SecretManagerService();
