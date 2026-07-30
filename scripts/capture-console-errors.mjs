import { spawn } from 'child_process'
import http from 'http'
import fs from 'fs'
import WebSocket from 'ws'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.CDP_PORT || 9245)
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3460'
const pages = ['/', '/tenders', '/contact', '/auth/signin', '/support']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(d))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

function putJSON(path) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path, method: 'PUT' },
      (res) => {
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(d))
          } catch {
            resolve(null)
          }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.end()
  })
}

async function withPage(wsUrl, fn) {
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => {
    ws.once('open', res)
    ws.once('error', rej)
  })
  let id = 0
  const pending = new Map()
  const consoleMsgs = []
  const exceptions = []
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString())
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a) => a.value ?? a.description ?? a.unserializableValue ?? JSON.stringify(a))
        .join(' ')
      consoleMsgs.push({ type: msg.params.type, text })
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const ex = msg.params.exceptionDetails || {}
      exceptions.push({
        text: ex.text,
        description: ex.exception?.description,
        url: ex.url,
        line: ex.lineNumber,
      })
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mid = ++id
      pending.set(mid, resolve)
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  const out = await fn({ send, consoleMsgs, exceptions })
  ws.close()
  return out
}

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/tb-chrome-profile3',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
)

for (let i = 0; i < 50; i++) {
  try {
    await getJSON(`http://127.0.0.1:${PORT}/json/version`)
    break
  } catch {
    await sleep(200)
  }
}

const results = {}
for (const path of pages) {
  const created = await putJSON(`/json/new?${encodeURIComponent(BASE + path)}`)
  await sleep(800)
  const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`)
  const page =
    (created && created.webSocketDebuggerUrl && created) ||
    targets.find((t) => t.type === 'page' && (t.url || '').includes(BASE + path)) ||
    targets.find((t) => t.type === 'page' && (t.url || '').startsWith(BASE)) ||
    targets.find((t) => t.type === 'page')

  if (!page?.webSocketDebuggerUrl) {
    console.log('no page for', path)
    continue
  }

  console.log('using', page.url, 'for', path)
  const result = await withPage(page.webSocketDebuggerUrl, async ({ send, consoleMsgs, exceptions }) => {
    await send('Page.navigate', { url: BASE + path })
    await sleep(4000)
    const evalRes = await send('Runtime.evaluate', {
      expression: `({
        title: document.title,
        text: (document.body && document.body.innerText || '').slice(0, 1200),
        appError: /Application error/i.test(document.body && document.body.innerText || ''),
        htmlLen: document.documentElement.outerHTML.length
      })`,
      returnByValue: true,
    })
    return {
      pageInfo: evalRes.result?.result?.value,
      evalError: evalRes.result?.exceptionDetails || evalRes.error,
      exceptions: [...exceptions],
      errors: consoleMsgs.filter(
        (m) => m.type === 'error' || /error|exception|hydrat|Application/i.test(m.text)
      ),
      allConsole: consoleMsgs.slice(0, 40),
    }
  })
  results[path] = result
  console.log('\n====', path, '====')
  console.log('pageInfo', JSON.stringify(result.pageInfo, null, 2))
  console.log('EXCEPTIONS', JSON.stringify(result.exceptions, null, 2))
  console.log('ERRORS', JSON.stringify(result.errors, null, 2))
}

fs.writeFileSync('/tmp/tb-local-console.json', JSON.stringify(results, null, 2))
chrome.kill()
console.log('DONE')
process.exit(0)
