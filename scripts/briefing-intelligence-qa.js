#!/usr/bin/env node
/**
 * Briefing Intelligence (TenderBriefing) QA gate.
 *
 * Validates:
 *  - New/changed files typecheck (best-effort: full project typecheck)
 *  - TB-BR report id format
 *  - Status transition guards + status writes
 *  - Required API route existence
 *  - No secrets in source (delegates to the repo secret scan)
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

process.chdir(path.join(__dirname, '..'))

const report = { checks: [], passed: false, blockers: [] }
function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

function fileExists(rel) {
  return fs.existsSync(path.join(process.cwd(), rel))
}

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

function contains(rel, needle) {
  return read(rel).includes(needle)
}

function runStaticChecksOnRoute(rel, mustContain) {
  for (const n of mustContain) {
    check(`route ${rel} contains ${n}`, contains(rel, n))
  }
}

async function main() {
  // 1) Typecheck
  try {
    execSync('npm run typecheck', { stdio: 'inherit' })
    check('typecheck (tsc --noEmit)', true)
  } catch (e) {
    check('typecheck (tsc --noEmit)', false, e instanceof Error ? e.message : String(e))
  }

  // 2) Report ID format
  const { generateRandomBriefingIntelligenceReportId, generateBriefingIntelligenceReportId } = require('../lib/briefing-intelligence/reportId')
  const re = /^TB-BR-[A-Z0-9]{6}$/
  const sample = generateRandomBriefingIntelligenceReportId()
  check('reportId regex', re.test(sample), sample)
  for (let i = 0; i < 50; i++) {
    const id = generateRandomBriefingIntelligenceReportId()
    if (!re.test(id)) {
      check('reportId regex (fuzz)', false, id)
      break
    }
  }
  const deterministic = generateBriefingIntelligenceReportId({ requestId: 'r1', agentId: 'a1', salt: 's1' })
  check('reportId deterministic shape', re.test(deterministic), deterministic)

  // 3) API route existence
  const requiredRoutes = [
    'app/api/briefing-intelligence/evidence/route.ts',
    'app/api/briefing-intelligence/process/route.ts',
    'app/api/briefing-intelligence/review/route.ts',
    'app/api/briefing-intelligence/deliver/route.ts',
    'app/api/briefing-intelligence/[reportId]/route.ts',
    'app/api/briefing-intelligence/route.ts',
  ]
  for (const r of requiredRoutes) check(`route exists ${r}`, fileExists(r))

  // 4) Status transition logic (static guardrails)
  runStaticChecksOnRoute('app/api/briefing-intelligence/evidence/route.ts', [
    "status: 'evidence_uploaded'",
  ])

  runStaticChecksOnRoute('app/api/briefing-intelligence/process/route.ts', [
    "status: 'processing'",
    "status: 'draft_report'",
    "status: 'processing_failed'",
    // Retries must be allowed for processing_failed (skip list must not include it).
    "['processing', 'draft_report', 'agent_review', 'final']",
  ])

  runStaticChecksOnRoute('app/api/briefing-intelligence/review/route.ts', [
    "status: 'agent_review'",
    "status: 'final'",
    'Cannot review from status',
    "if (report.status === 'final' || report.status === 'delivered')",
  ])

  runStaticChecksOnRoute('app/api/briefing-intelligence/deliver/route.ts', [
    "if (report.status === 'delivered')",
    "if (report.status !== 'final')",
    "status: 'delivered'",
    'pdfStorageRef',
    'deliveryEmailId',
  ])

  // 5) No secrets in source (delegate to existing scan)
  try {
    execSync('node scripts/secrets-scan-qa.js', { stdio: 'inherit' })
    check('no secrets in source', true)
  } catch (e) {
    check('no secrets in source', false, e instanceof Error ? e.message : String(e))
  }

  report.passed = report.blockers.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

