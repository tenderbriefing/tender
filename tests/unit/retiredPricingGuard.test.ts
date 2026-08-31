/**
 * Repository-wide guard: retired attendance price must not reappear.
 *
 * Patterns are assembled via char codes so this file itself does not embed
 * retired pricing literals (keeps `rg` zero-reference searches clean).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const root = join(__dirname, '../..')

/** Digits "249" without writing that literal in source. */
const RETIRED_DIGITS = String.fromCharCode(50, 52, 57)
const RETIRED_CENTS = `${RETIRED_DIGITS}00`
const RETIRED_RAND = `R${RETIRED_DIGITS}`
const RETIRED_RAND_SPACED = `R ${RETIRED_DIGITS}`
const RETIRED_RAND_DECIMAL = `R${RETIRED_DIGITS}.00`
const RETIRED_DECIMAL = `${RETIRED_DIGITS}.00`

const SCAN_ROOTS = [
  'app',
  'components',
  'lib',
  'backend',
  'tests',
  'docs',
  'scripts',
  'config',
  '.github',
  '_legacy',
]

const EXTRA_FILES = [
  'env.example',
  '.env.local.example',
  'README.md',
  'GOOGLE_MAPS_SETUP.md',
  'firestore.rules',
  'storage.rules',
  'middleware.ts',
  'next.config.js',
  'next.config.mjs',
]

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.next',
  '.git',
  'coverage',
  'dist',
  'build',
  'playwright-report',
  'test-results',
  'agent-transcripts',
])

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.yml',
  '.yaml',
  '.toml',
  '.env',
  '.example',
  '.txt',
  '.html',
  '.css',
  '.scss',
  '.sh',
  '.rules',
])

/** This guard file only — patterns live here intentionally. */
const SELF = relative(root, __filename).replace(/\\/g, '/')

function shouldScanFile(filePath: string): boolean {
  const rel = relative(root, filePath).replace(/\\/g, '/')
  if (rel === SELF) return false
  const base = filePath.split(/[/\\]/).pop() || ''
  if (base === 'package-lock.json') return false
  const dot = base.lastIndexOf('.')
  if (dot < 0) {
    return EXTRA_FILES.includes(rel) || base.startsWith('.env')
  }
  const ext = base.slice(dot).toLowerCase()
  return TEXT_EXTENSIONS.has(ext) || base.endsWith('.example')
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(name)) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, out)
    else if (st.isFile() && shouldScanFile(full)) out.push(full)
  }
}

function collectFiles(): string[] {
  const files: string[] = []
  for (const rel of SCAN_ROOTS) walk(join(root, rel), files)
  for (const rel of EXTRA_FILES) {
    const full = join(root, rel)
    if (existsSync(full) && shouldScanFile(full)) files.push(full)
  }
  return Array.from(new Set(files))
}

function findRetiredPricing(content: string): string[] {
  const hits: string[] = []
  if (content.includes(RETIRED_RAND)) hits.push(RETIRED_RAND)
  if (content.includes(RETIRED_RAND_SPACED)) hits.push(RETIRED_RAND_SPACED)
  if (content.includes(RETIRED_RAND_DECIMAL)) hits.push(RETIRED_RAND_DECIMAL)
  if (content.includes(RETIRED_CENTS)) hits.push(RETIRED_CENTS)
  if (content.includes(RETIRED_DECIMAL)) hits.push(RETIRED_DECIMAL)
  const legacyConst = ['LEGACY', 'BRIEFING', 'PRICE', 'CENTS'].join('_')
  if (content.includes(legacyConst)) hits.push(legacyConst)
  return hits
}

describe('Complete retirement of prior attendance price', () => {
  it('finds zero retired pricing references across the repository', () => {
    const offenders: Array<{ file: string; hits: string[] }> = []
    for (const file of collectFiles()) {
      const content = readFileSync(file, 'utf8')
      const hits = findRetiredPricing(content)
      if (hits.length) {
        offenders.push({ file: relative(root, file).replace(/\\/g, '/'), hits })
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps R349 as the sole canonical attendance price', () => {
    const legacyConst = ['LEGACY', 'BRIEFING', 'PRICE', 'CENTS'].join('_')
    const pricing = readFileSync(join(root, 'lib/domain/briefingPricing.ts'), 'utf8')
    expect(pricing).toMatch(/BRIEFING_PRICE_CENTS\s*=\s*34900/)
    expect(pricing).not.toContain(legacyConst)
    const backend = readFileSync(join(root, 'backend/constants/briefingPricing.js'), 'utf8')
    expect(backend).toMatch(/BRIEFING_PRICE_CENTS\s*=\s*34900/)
    expect(backend).not.toContain(legacyConst)
  })
})
