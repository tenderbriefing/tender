#!/usr/bin/env node
/**
 * Critical dependency audit gate with explicit allowlist.
 * Fails CI when a new critical advisory appears that is not allowlisted.
 * High/moderate are reported but do not fail (tracked separately).
 *
 * Allowlist entries must include advisory URL + justification + review-by date.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ALLOWLIST_PATH = path.join(__dirname, '..', 'security', 'npm-audit-allowlist.json')

function loadAllowlist() {
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'))
  const entries = Array.isArray(raw.allowlist) ? raw.allowlist : []
  const byUrl = new Map()
  for (const entry of entries) {
    if (!entry?.url || !entry?.reason) {
      throw new Error('Allowlist entries require url + reason')
    }
    byUrl.set(String(entry.url).trim(), entry)
  }
  return byUrl
}

function collectCriticalAdvisories(audit) {
  const found = []
  const vulns = audit.vulnerabilities || {}
  for (const [name, meta] of Object.entries(vulns)) {
    if (meta.severity !== 'critical') continue
    for (const via of meta.via || []) {
      if (via && typeof via === 'object' && via.url) {
        found.push({
          package: name,
          url: String(via.url).trim(),
          title: via.title || name,
        })
      }
    }
  }
  return found
}

function main() {
  let audit
  try {
    const out = execSync('npm audit --omit=dev --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    audit = JSON.parse(out)
  } catch (err) {
    // npm audit exits non-zero when vulns exist; stdout still has JSON
    const out = err.stdout?.toString?.() || ''
    try {
      audit = JSON.parse(out)
    } catch {
      console.error('npm-audit-gate: failed to parse npm audit JSON')
      process.exit(1)
    }
  }

  const allowlist = loadAllowlist()
  const critical = collectCriticalAdvisories(audit)
  const unapproved = []
  const approved = []

  for (const item of critical) {
    if (allowlist.has(item.url)) {
      approved.push({ ...item, reason: allowlist.get(item.url).reason })
    } else {
      unapproved.push(item)
    }
  }

  console.log(
    JSON.stringify(
      {
        criticalCount: critical.length,
        allowlisted: approved.map((a) => ({ package: a.package, url: a.url })),
        unapproved: unapproved.map((a) => ({ package: a.package, url: a.url, title: a.title })),
      },
      null,
      2
    )
  )

  if (unapproved.length) {
    console.error(
      `npm-audit-gate: FAIL — ${unapproved.length} critical advisory(ies) not in allowlist`
    )
    process.exit(1)
  }

  console.log(
    `npm-audit-gate: PASS — ${critical.length} critical (all allowlisted), no new criticals`
  )
}

main()
