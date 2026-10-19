#!/usr/bin/env node
/**
 * Phase 17 — 30-day OCDS vs local mirror reconciliation + 25-sample field check.
 *
 * Usage:
 *   STORAGE_ADAPTER=firestore node scripts/phase17-ocds-mirror-recon.js
 *   node scripts/phase17-ocds-mirror-recon.js --lookback=7 --sample=10
 */
const fs = require('fs')
const path = require('path')

async function main() {
  const args = process.argv.slice(2)
  const lookback = Number(
    (args.find((a) => a.startsWith('--lookback=')) || '--lookback=30').split('=')[1]
  )
  const sampleSize = Number(
    (args.find((a) => a.startsWith('--sample=')) || '--sample=25').split('=')[1]
  )

  if (!process.env.STORAGE_ADAPTER) {
    process.env.STORAGE_ADAPTER = 'firestore'
  }

  const { reconcileAndSample } = require('../backend/services/ocdsMirrorReconciliationService')
  console.log(`[phase17] reconciling last ${lookback} day(s), sample=${sampleSize}…`)
  const { recon, sample } = await reconcileAndSample({ lookbackDays: lookback, sampleSize })

  const out = {
    generatedAt: new Date().toISOString(),
    lookbackDays: lookback,
    recon,
    sample: {
      sampleSize: sample.sampleSize,
      passCount: sample.passCount,
      failCount: sample.failCount,
      results: sample.results,
    },
    verdict:
      recon.missingLocallyCount === 0 && !recon.fetchIncomplete
        ? 'PASS'
        : recon.missingLocallyCount === 0 && recon.fetchIncomplete
          ? 'INCOMPLETE_FETCH'
          : 'FAIL_MISSING_LOCAL',
  }

  const outPath = path.join(process.cwd(), 'tmp-phase17-ocds-mirror-recon.json')
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({
    verdict: out.verdict,
    sourceCount: recon.sourceCount,
    localMirrorCount: recon.localMirrorCount,
    matchedCount: recon.matchedCount,
    missingLocallyCount: recon.missingLocallyCount,
    fieldMismatchCount: recon.fieldMismatchCount,
    documentMismatchCount: recon.documentMismatchCount,
    samplePass: sample.passCount,
    sampleFail: sample.failCount,
    fetchIncomplete: recon.fetchIncomplete,
    outPath,
  }, null, 2))

  if (recon.missingLocallyCount > 0) {
    console.log('\nMissing locally (first 20):')
    for (const m of (recon.missingLocally || []).slice(0, 20)) {
      console.log(`- ${m.tenderNumber || m.ocid}: ${m.title}`)
    }
  }
}

main().catch((err) => {
  console.error('[phase17] failed:', err)
  process.exit(1)
})
