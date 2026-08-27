#!/usr/bin/env node
/**
 * Store SPEECHMATICS_API_KEY into Google Secret Manager as Speechmatic_api.
 * Usage: SPEECHMATICS_API_KEY=... node scripts/save-speechmatics-key.js
 * Does not print the secret value.
 */
const { execFileSync } = require('child_process')
const { writeFileSync, unlinkSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')

const secretValue = process.env.SPEECHMATICS_API_KEY
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'tenderbriefing-34679'
const secretId = 'Speechmatic_api'

if (!secretValue || !String(secretValue).trim()) {
  console.error('Set SPEECHMATICS_API_KEY in your environment before running this script.')
  process.exit(1)
}

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: 'inherit' })
}

const tmpPath = join(tmpdir(), `speechmatics-secret-${process.pid}.txt`)
try {
  writeFileSync(tmpPath, String(secretValue).trim(), { encoding: 'utf8', mode: 0o600 })

  try {
    execFileSync('gcloud', ['secrets', 'describe', secretId, `--project=${projectId}`], {
      stdio: 'pipe',
    })
    console.log(`Secret ${secretId} exists — adding new version`)
  } catch {
    console.log(`Creating secret ${secretId}`)
    run('gcloud', [
      'secrets',
      'create',
      secretId,
      `--project=${projectId}`,
      '--replication-policy=automatic',
    ])
  }

  run('gcloud', [
    'secrets',
    'versions',
    'add',
    secretId,
    `--project=${projectId}`,
    `--data-file=${tmpPath}`,
  ])
  console.log(`Saved ${secretId} (value not logged). Mount as SPEECHMATICS_API_KEY in Cloud Run.`)
} catch (err) {
  console.error('Failed to save Speechmatics secret:', err instanceof Error ? err.message : String(err))
  process.exit(1)
} finally {
  try {
    unlinkSync(tmpPath)
  } catch {
    /* ignore */
  }
}
