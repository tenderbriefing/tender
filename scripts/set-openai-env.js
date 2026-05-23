// Writes OPENAI_API_KEY from the environment into .env.local for local dev.
// Usage: OPENAI_API_KEY=sk-... node scripts/set-openai-env.js

const fs = require('fs');
const path = require('path');

const openaiKey = process.env.OPENAI_API_KEY;

if (!openaiKey) {
  console.error('Set OPENAI_API_KEY in your shell before running this script.');
  process.exit(1);
}

const envContent = `# OpenAI API Key (local only — use Secret Manager in production)
OPENAI_API_KEY=${openaiKey}
`;

const envPath = path.join(__dirname, '..', '.env.local');

try {
  fs.writeFileSync(envPath, envContent);
  console.log('OpenAI API key saved to .env.local');
  console.log('.env.local is gitignored; do not commit it.');
} catch (error) {
  console.error('Error saving OpenAI API key:', error.message);
  process.exit(1);
}
