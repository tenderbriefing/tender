#!/usr/bin/env node
/**
 * Phase 17 — Native agent app structure QA (no secrets).
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', 'mobile-agent-app')
const report = { checks: [], passed: false, blockers: [] }

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

const required = [
  'package.json',
  'app.json',
  '.env.example',
  'README.md',
  'src/api/client.ts',
  'src/offline/queue.ts',
  'src/config/firebase.ts',
  'src/navigation/RootNavigator.tsx',
  'src/screens/LoginScreen.tsx',
  'src/screens/DispatchScreen.tsx',
  'src/screens/BriefingDetailScreen.tsx',
  'src/screens/CheckInScreen.tsx',
  'src/screens/ReportUploadScreen.tsx',
  'src/screens/EarningsScreen.tsx',
  'src/screens/PerformanceScreen.tsx',
  'src/screens/ProfileScreen.tsx',
]

for (const f of required) check(`file ${f}`, exists(f))

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
check('expo dependency', Boolean(pkg.dependencies?.expo))
check('firebase dependency', Boolean(pkg.dependencies?.firebase))
check('expo-location', Boolean(pkg.dependencies?.['expo-location']))
check('expo-camera', Boolean(pkg.dependencies?.['expo-camera']))
check('expo-av', Boolean(pkg.dependencies?.['expo-av']))
check('async-storage', Boolean(pkg.dependencies?.['@react-native-async-storage/async-storage']))
check('scripts typecheck', Boolean(pkg.scripts?.typecheck))

const client = fs.readFileSync(path.join(root, 'src/api/client.ts'), 'utf8')
check('Bearer token header', client.includes('Authorization') && client.includes('Bearer'))
check('dispatch API path', client.includes('/api/mobile/v1/dispatch'))
check('check-in API path', client.includes('/api/mobile/v1/check-in'))
check('offline-sync path', client.includes('/api/mobile/v1/offline-sync'))

const envEx = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
check('env example has API URL', envEx.includes('EXPO_PUBLIC_API_BASE_URL'))
check('env example no filled secrets', !/AIzaSy[A-Za-z0-9_-]{20,}/.test(envEx))

check('.env gitignored', fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('.env'))

const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
check('root mobile:agent:qa script', Boolean(rootPkg.scripts?.['mobile:agent:qa']))

report.passed = report.blockers.length === 0
report.operationalReadiness = report.passed ? 'ready' : 'blocked'
console.log(JSON.stringify(report, null, 2))
process.exit(report.passed ? 0 : 1)
