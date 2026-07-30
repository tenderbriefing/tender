import { spawn } from 'child_process'
import http from 'http'
import fs from 'fs'
import WebSocket from 'ws'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.CDP_PORT || 9260)
const BASE = process.env.BASE_URL || 'https://www.tenderbriefing.co.za'
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
        .map((a) => a.value ?? a.description ?? JSON.stringify(a))
        .join(' ')
      consoleMsgs.push({ type: msg.params.type, text })
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const ex = msg.params.exceptionDetails || {}
      exceptions.push({ text: ex.text, description: ex.exception?.description })
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
    `--user-data-dir=/tmp/tb-chrome-verify-${PORT}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
)

let errBuf = ''
chrome.stderr.on('data', (d) => {
  errBuf += d.toString()
})

let ready = false
for (let i = 0; i < 80; i++) {
  try {
    await getJSON(`http://127.0.0.1:${PORT}/json/version`)
    ready = true
    console.log('chrome ready on', PORT)
    break
  } catch {
    await sleep(250)
  }
}
if (!ready) {
  console.error('chrome failed to start', errBuf.slice(0, 800))
  process.exit(1)
}

const results = {}
for (const path of pages) {
  const page = await putJSON(`/json/new?${encodeURIComponent(BASE + path)}`)
  await sleep(700)
  if (!page?.webSocketDebuggerUrl) {
    console.log('no page for', path)
    continue
  }
  const result = await withPage(page.webSocketDebuggerUrl, async ({ send, consoleMsgs, exceptions }) => {
    await send('Page.navigate', { url: BASE + path })
    await sleep(5000)
    const evalRes = await send('Runtime.evaluate', {
      expression: `({
        title: document.title,
        appError: /Application error/i.test(document.body && document.body.innerText || ''),
        text: (document.body && document.body.innerText || '').slice(0, 350)
      })`,
      returnByValue: true,
    })
    return {
      pageInfo: evalRes.result?.result?.value,
      exceptions: [...exceptions],
      errors: consoleMsgs.filter(
        (m) => m.type === 'error' || /ChunkLoad|Application|hydrat/i.test(m.text)
      ),
    }
  })
  results[path] = result
  console.log('\n====', path, '====')
  console.log(JSON.stringify(result.pageInfo, null, 2))
  console.log('ERRORS', JSON.stringify(result.errors, null, 2))
  console.log('EXCEPTIONS', JSON.stringify(result.exceptions, null, 2).slice(0, 800))
}

fs.writeFileSync('/tmp/tb-verify-final.json', JSON.stringify(results, null, 2))
chrome.kill()
console.log('DONE')
