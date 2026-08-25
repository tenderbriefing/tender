#!/usr/bin/env node
/**
 * Dry-run / bounded backfill scaffold for Phase 1 → Phase 2 organisation linkage.
 * Does NOT run against production automatically.
 *
 * Usage:
 *   node scripts/backfill-private-tender-organisations.js --dry-run
 *   node scripts/backfill-private-tender-organisations.js --apply --limit=50
 */
const args = process.argv.slice(2)
const dryRun = !args.includes('--apply')
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = Math.min(Number(limitArg?.split('=')[1] || 50), 200)

console.log(
  JSON.stringify(
    {
      ok: true,
      dryRun,
      limit,
      message:
        'Scaffold only — implement explicit Founder-approved backfill before apply. Legacy Phase 1 rows without organisationId remain Founder-visible and are ignored by /procurement.',
    },
    null,
    2
  )
)
process.exit(0)
