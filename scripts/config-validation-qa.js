#!/usr/bin/env node
/** Soft production config validation for CI (no secrets required). */
const fs = require('fs')
const path = require('path')

const example = fs.readFileSync(path.join(__dirname, '..', '.env.local.example'), 'utf8')
const requiredNames = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'PAYFAST_MERCHANT_ID',
  'PAYFAST_MERCHANT_KEY',
]

for (const name of requiredNames) {
  if (!example.includes(name)) {
    console.error(`config-validation-qa: missing ${name} in .env.local.example`)
    process.exit(1)
  }
}

const runtime = fs.readFileSync(
  path.join(__dirname, '..', 'lib/config/runtimeConfig.ts'),
  'utf8'
)
if (!runtime.includes('validateProductionConfigSoft')) {
  console.error('config-validation-qa: runtimeConfig missing validateProductionConfigSoft')
  process.exit(1)
}

console.log('config-validation-qa: all checks passed')
