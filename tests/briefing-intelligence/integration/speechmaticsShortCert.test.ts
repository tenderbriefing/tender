/**
 * Real Speechmatics short-audio certification (opt-in).
 * SPEECHMATICS_SHORT_CERT=1 SPEECHMATICS_API_KEY=... npx vitest run tests/briefing-intelligence/integration/speechmaticsShortCert.test.ts
 */
import { describe, it, expect, afterAll } from 'vitest'
import { createServer } from 'http'
import { execFileSync } from 'child_process'
import { mkdtemp, readFile, rm, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getTranscriptionProvider } from '@/lib/briefing-intelligence/transcriptionService'
import { SpeechmaticsTranscriptionProvider } from '@/lib/briefing-intelligence/speechmaticsTranscriptionProvider'
import { isBriefingAudioChunkingEnabled } from '@/lib/briefing-intelligence/featureFlag'

const ENABLED = process.env.SPEECHMATICS_SHORT_CERT === '1'
const HAS_KEY = Boolean((process.env.SPEECHMATICS_API_KEY || '').trim())
const suite = ENABLED && HAS_KEY ? describe : describe.skip

suite('Speechmatics short-audio real-provider certification', () => {
  let fixturePath = ''
  let closeServer: (() => Promise<void>) | null = null
  let audioUrl = ''

  afterAll(async () => {
    if (closeServer) await closeServer()
    if (fixturePath) await unlink(fixturePath).catch(() => undefined)
  })

  it('defaults to Speechmatics and chunking remains off', () => {
    delete process.env.BRIEFING_INTELLIGENCE_PROVIDER
    delete process.env.BRIEFING_AUDIO_CHUNKING_ENABLED
    process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED = 'true'
    expect(getTranscriptionProvider()).toBeInstanceOf(SpeechmaticsTranscriptionProvider)
    expect(isBriefingAudioChunkingEnabled()).toBe(false)
  })

  it('transcribes a short fixture via real Speechmatics Batch API', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tb-sm-short-'))
    const aiffPath = join(dir, 'short.aiff')
    fixturePath = join(dir, 'short.mp3')
    execFileSync(
      'say',
      [
        '-r',
        '180',
        '-o',
        aiffPath,
        'Tender briefing smoke test. Closing date is fifteenth March twenty twenty six. Site meeting is mandatory.',
      ],
      { stdio: 'pipe' }
    )
    execFileSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        aiffPath,
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '64k',
        fixturePath,
      ],
      { stdio: 'pipe' }
    )

    const buf = await readFile(fixturePath)
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length })
      res.end(buf)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('bind failed')
    audioUrl = `http://127.0.0.1:${addr.port}/short.mp3`
    closeServer = () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))

    const provider = new SpeechmaticsTranscriptionProvider()
    const started = Date.now()
    const res = await provider.transcribe(audioUrl)
    const elapsedMs = Date.now() - started

    expect(res.provider).toBe('speechmatics')
    expect(res.transcriptText).toBeTruthy()
    expect(String(res.transcriptText).trim().length).toBeGreaterThan(0)
    expect(res.segments.length).toBeGreaterThan(0)

    console.info('[speechmatics-short-cert]', {
      provider: res.provider,
      model: res.model,
      wordCount: res.transcriptWordCount,
      durationSeconds: res.durationSeconds,
      segmentCount: res.segments.length,
      jobId: (res.rawProviderPayload as any)?.jobId ?? null,
      elapsedMs,
      textLen: res.transcriptText.length,
    })

    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }, 300_000)
})
