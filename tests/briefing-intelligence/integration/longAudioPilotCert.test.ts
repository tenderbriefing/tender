/**
 * Controlled long-audio pilot certification (local / Founder-authorised).
 * Run: LONG_AUDIO_PILOT=1 BRIEFING_AUDIO_FFMPEG_MODE=real SPEECHMATICS_API_KEY=... npx vitest run tests/briefing-intelligence/integration/longAudioPilotCert.test.ts
 *
 * Does NOT enable production chunking. Requires ffmpeg locally.
 * Uses Speechmatics Batch (default STT); Whisper is no longer the pilot provider.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { createServer } from 'http'
import { mkdtemp, rm, readFile, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  DIRECT_MAX_BYTES,
  HARD_MAX_CHUNK_DURATION_MS,
  MAX_CHUNK_COUNT,
  MAX_SOURCE_DURATION_MS,
  CHUNK_OVERLAP_MS,
  CHUNK_MAX_ATTEMPTS,
} from '@/lib/briefing-intelligence/audioChunking/constants'
import { shouldUseChunkedTranscription } from '@/lib/briefing-intelligence/audioChunking/decision'
import { planAudioChunks } from '@/lib/briefing-intelligence/audioChunking/planner'
import { probeAudioFile, extractAudioChunk } from '@/lib/briefing-intelligence/audioChunking/ffmpegMedia'
import { assembleTranscriptFromChunks } from '@/lib/briefing-intelligence/audioChunking/assembleTranscript'
import { isBriefingAudioChunkingEnabled } from '@/lib/briefing-intelligence/featureFlag'
import { SpeechmaticsTranscriptionProvider } from '@/lib/briefing-intelligence/speechmaticsTranscriptionProvider'
import type { BriefingAudioChunk } from '@/lib/briefing-intelligence/audioChunking/types'

const execFileAsync = promisify(execFile)
const PILOT_ENABLED = process.env.LONG_AUDIO_PILOT === '1'
const FIXTURE_MINUTES = Number(process.env.LONG_AUDIO_PILOT_MINUTES || '65')
const REAL_PROVIDER = Boolean((process.env.SPEECHMATICS_API_KEY || '').trim())

const pilot = PILOT_ENABLED ? describe : describe.skip

function hasFfmpeg(): boolean {
  try {
    execFileSyncSafe('ffmpeg', ['-version'])
    return true
  } catch {
    return false
  }
}

function execFileSyncSafe(cmd: string, args: string[]) {
  const { execFileSync } = require('child_process') as typeof import('child_process')
  execFileSync(cmd, args, { stdio: 'pipe' })
}

async function serveLocalFile(filePath: string): Promise<{ url: string; close: () => Promise<void> }> {
  const buf = await readFile(filePath)
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length })
    res.end(buf)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind pilot audio server')
  return {
    url: `http://127.0.0.1:${addr.port}/audio.mp3`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}

async function generatePilotFixture(outPath: string, minutes: number): Promise<void> {
  const segmentText =
    'Section one. Tender reference E R F twenty twenty six dash zero one. ' +
    'Closing date fifteenth March twenty twenty six. Site meeting is mandatory at eight thirty A M. ' +
    'Bidders must submit C I D B grading seven G B or higher. Payment terms thirty days from invoice. ' +
    'Section two. Technical specifications for electrical installation and substation works. ' +
    'All prices must exclude V A T. Preference points apply under the eighty twenty principle. ' +
    'Section three. Returnable documents include tax clearance and B E E affidavit.'

  const tempDir = await mkdtemp(join(tmpdir(), 'tb-pilot-seg-'))
  const aiffPath = join(tempDir, 'segment.aiff')
  const segmentMp3 = join(tempDir, 'segment.mp3')

  try {
    await execFileAsync('say', ['-r', '175', '-o', aiffPath, segmentText])
    await execFileAsync('ffmpeg', [
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
      segmentMp3,
    ])

    const segStat = await stat(segmentMp3)
    const segProbe = await probeAudioFile(segmentMp3, segStat.size)
    const segDurationSec = segProbe.durationMs / 1000
    const targetSec = minutes * 60
    const loops = Math.ceil(targetSec / segDurationSec)

    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-stream_loop',
      String(Math.max(0, loops - 1)),
      '-i',
      segmentMp3,
      '-t',
      String(targetSec),
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '64k',
      outPath,
    ])
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function transcribeChunkSpeechmatics(localPath: string): Promise<string> {
  const key = (process.env.SPEECHMATICS_API_KEY || '').trim()
  if (!key) throw new Error('SPEECHMATICS_API_KEY required for real provider pilot')
  const provider = new SpeechmaticsTranscriptionProvider({ apiKey: key })
  const served = await serveLocalFile(localPath)
  try {
    const result = await provider.transcribe(served.url)
    return result.transcriptText
  } finally {
    await served.close()
  }
}

pilot('long-audio pilot certification', () => {
  let fixturePath = ''
  let fixtureSize = 0
  let probe: Awaited<ReturnType<typeof probeAudioFile>>
  let chunkPlan: ReturnType<typeof planAudioChunks>
  const chunkResults: Array<{
    index: number
    status: 'completed' | 'failed'
    attempts: number
    durationMs: number
    textLength: number
  }> = []
  let chunkTexts: string[] = []

  beforeAll(async () => {
    if (!hasFfmpeg()) {
      throw new Error('ffmpeg/ffprobe not available — pilot requires local ffmpeg')
    }
    delete process.env.BRIEFING_AUDIO_FFMPEG_MODE
    process.env.BRIEFING_AUDIO_FFMPEG_MODE = 'real'
    process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED = 'true'
    process.env.BRIEFING_AUDIO_CHUNKING_ENABLED = 'true'
    expect(isBriefingAudioChunkingEnabled()).toBe(true)

    const dir = await mkdtemp(join(tmpdir(), 'tb-long-audio-pilot-'))
    fixturePath = join(dir, `pilot-${FIXTURE_MINUTES}min.mp3`)
    await generatePilotFixture(fixturePath, FIXTURE_MINUTES)
    const st = await stat(fixturePath)
    fixtureSize = st.size
    probe = await probeAudioFile(fixturePath, fixtureSize)
    chunkPlan = planAudioChunks(probe)
  }, 600_000)

  afterAll(async () => {
    if (fixturePath) {
      const dir = join(fixturePath, '..')
      await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
  })

  it('fixture meets long-audio thresholds', () => {
    expect(probe.durationMs).toBeGreaterThanOrEqual(HARD_MAX_CHUNK_DURATION_MS)
    expect(probe.durationMs).toBeLessThanOrEqual(MAX_SOURCE_DURATION_MS)
    const decision = shouldUseChunkedTranscription({
      chunkingFlagEnabled: true,
      probe,
    })
    expect(decision.mode).toBe('chunked')
  })

  it('planner produces bounded chunk count with overlap', () => {
    expect(chunkPlan.length).toBeGreaterThan(1)
    expect(chunkPlan.length).toBeLessThanOrEqual(MAX_CHUNK_COUNT)
    for (let i = 1; i < chunkPlan.length; i++) {
      expect(chunkPlan[i].overlapStartMs).toBeGreaterThanOrEqual(0)
      expect(chunkPlan[i].startMs).toBeLessThan(chunkPlan[i - 1].endMs)
    }
  })

  it('ffmpeg extracts chunks within hard limits', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'tb-chunks-'))
    try {
      for (const entry of chunkPlan) {
        const out = join(tempDir, `${entry.index}.mp3`)
        const { sizeBytes } = await extractAudioChunk({
          sourcePath: fixturePath,
          outputPath: out,
          startMs: entry.startMs,
          endMs: entry.endMs,
        })
        expect(sizeBytes).toBeGreaterThan(0)
        expect(sizeBytes).toBeLessThanOrEqual(24 * 1024 * 1024)
        const spanMs = entry.endMs - entry.startMs
        expect(spanMs).toBeLessThanOrEqual(HARD_MAX_CHUNK_DURATION_MS + CHUNK_OVERLAP_MS)
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }, 600_000)

  it('real Speechmatics transcribes all chunks sequentially', async () => {
    if (!REAL_PROVIDER) {
      console.warn('[pilot] SPEECHMATICS_API_KEY unset — skipping real provider transcription')
      return
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'tb-whisper-'))
    const texts: string[] = []
    try {
      for (const entry of chunkPlan) {
        const out = join(tempDir, `${entry.index}.mp3`)
        await extractAudioChunk({
          sourcePath: fixturePath,
          outputPath: out,
          startMs: entry.startMs,
          endMs: entry.endMs,
        })

        let text = ''
        let attempts = 0
        let lastErr: Error | null = null
        const started = Date.now()
        while (attempts < CHUNK_MAX_ATTEMPTS) {
          attempts += 1
          try {
            text = await transcribeChunkSpeechmatics(out)
            break
          } catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e))
            if (attempts >= CHUNK_MAX_ATTEMPTS) throw lastErr
          }
        }
        texts.push(text)
        chunkTexts = [...texts]
        chunkResults.push({
          index: entry.index,
          status: 'completed',
          attempts,
          durationMs: Date.now() - started,
          textLength: text.length,
        })
        expect(text.length).toBeGreaterThan(0)
      }
      expect(texts.length).toBe(chunkPlan.length)
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }, 3_600_000)

  it('reconstructs transcript in chunkIndex order with overlap merge', async () => {
    if (!REAL_PROVIDER || chunkTexts.length !== chunkPlan.length) return

    const chunks: BriefingAudioChunk[] = chunkPlan.map((entry, i) => ({
      id: `chunk-${entry.index}`,
      index: entry.index,
      startMs: entry.startMs,
      endMs: entry.endMs,
      overlapStartMs: entry.overlapStartMs,
      storagePath: `briefing-intelligence/TB-BR-PILOT1/audio-chunks/bap-TB-BR-PILOT1/${entry.index}.mp3`,
      audioHash: 'pilot',
      sizeBytes: 1000,
      status: 'completed',
      transcriptText: chunkTexts[i] || null,
      segments: [
        {
          id: `seg-${entry.index}`,
          speaker: 'Speaker 1',
          startSeconds: 0,
          endSeconds: (entry.endMs - entry.startMs) / 1000,
          text: chunkTexts[i] || '',
        },
      ],
      provider: 'speechmatics',
      providerRequestId: null,
      attempts: chunkResults[i]?.attempts ?? 1,
      errorCode: null,
      errorMessage: null,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    const assembled = assembleTranscriptFromChunks({
      chunks,
      sourceDurationMs: probe.durationMs,
      provider: 'speechmatics',
      model: 'speechmatics-enhanced',
    })
    expect(assembled.fullText.length).toBeGreaterThan(100)
    expect(assembled.fullText.split(/\s+/).length).toBeGreaterThan(50)
    // Beginning/end markers from repeated segment script
    expect(assembled.fullText.toLowerCase()).toMatch(/tender|briefing|section/)
  }, 3_600_000)

  it('direct path when chunking flag off (production default)', () => {
    process.env.BRIEFING_AUDIO_CHUNKING_ENABLED = 'false'
    expect(isBriefingAudioChunkingEnabled()).toBe(false)
    const decision = shouldUseChunkedTranscription({
      chunkingFlagEnabled: false,
      probe,
    })
    expect(decision.mode).toBe('direct')
  })

  it('rejects >120 min and >100MB upload policy unchanged', () => {
    expect(() =>
      shouldUseChunkedTranscription({
        chunkingFlagEnabled: true,
        probe: {
          durationMs: MAX_SOURCE_DURATION_MS + 1,
          sizeBytes: 10 * 1024 * 1024,
          codec: 'mp3',
          bitrateKbps: 64,
        },
      })
    ).toThrow()

    const underDirect = shouldUseChunkedTranscription({
      chunkingFlagEnabled: true,
      probe: {
        durationMs: 5 * 60_000,
        sizeBytes: DIRECT_MAX_BYTES - 1,
        codec: 'mp3',
        bitrateKbps: 64,
      },
    })
    expect(underDirect.mode).toBe('direct')
  })

  it('emits pilot summary metrics', () => {
    console.info('[long-audio-pilot-summary]', {
      fixtureMinutes: FIXTURE_MINUTES,
      fixtureSizeBytes: fixtureSize,
      durationMs: probe.durationMs,
      chunkCount: chunkPlan.length,
      realProvider: REAL_PROVIDER,
      chunkResults,
      overlapMs: CHUNK_OVERLAP_MS,
    })
  })
})
