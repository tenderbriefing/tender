import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AudioProbeResult } from './types'

const execFileAsync = promisify(execFile)

export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

export function isFfmpegMockMode(): boolean {
  const raw = String(process.env.BRIEFING_AUDIO_FFMPEG_MODE || '').trim().toLowerCase()
  // Explicit real mode for opt-in pilots even under vitest NODE_ENV=test.
  if (raw === 'real') return false
  return raw === 'mock' || process.env.NODE_ENV === 'test'
}

/**
 * Estimate duration from file size when ffprobe unavailable (mock / fallback).
 * Assumes ~64 kbps mono speech ≈ 480 bytes/sec.
 */
export function estimateDurationMsFromSize(sizeBytes: number): number {
  const bytesPerSecond = 480
  return Math.max(1000, Math.round((sizeBytes / bytesPerSecond) * 1000))
}

export async function probeAudioFile(localPath: string, sizeBytes: number): Promise<AudioProbeResult> {
  if (isFfmpegMockMode()) {
    const durationMs = estimateDurationMsFromSize(sizeBytes)
    return {
      durationMs,
      sizeBytes,
      codec: 'mock',
      bitrateKbps: 64,
    }
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size:stream=codec_name,bit_rate',
      '-of',
      'json',
      localPath,
    ])
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string; size?: string }
      streams?: Array<{ codec_name?: string; bit_rate?: string }>
    }
    const durationSec = parseFloat(parsed.format?.duration || '0')
    const durationMs = Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : 0
    const stream = parsed.streams?.[0]
    const bitrate = stream?.bit_rate ? Math.round(parseInt(stream.bit_rate, 10) / 1000) : null
    return {
      durationMs: durationMs || estimateDurationMsFromSize(sizeBytes),
      sizeBytes,
      codec: stream?.codec_name || null,
      bitrateKbps: bitrate,
    }
  } catch (err) {
    throw Object.assign(
      new Error(
        `ffprobe failed: ${err instanceof Error ? err.message : String(err)}`
      ),
      { code: 'ffprobe_failed' }
    )
  }
}

export async function extractAudioChunk(params: {
  sourcePath: string
  outputPath: string
  startMs: number
  endMs: number
}): Promise<{ sizeBytes: number; hash: string }> {
  if (isFfmpegMockMode()) {
    const spanMs = Math.max(1, params.endMs - params.startMs)
    const payload = Buffer.from(`mock-chunk:${params.startMs}-${params.endMs}:${spanMs}`)
    await writeFile(params.outputPath, payload)
    return { sizeBytes: payload.length, hash: sha256Buffer(payload) }
  }

  const startSec = (params.startMs / 1000).toFixed(3)
  const durationSec = ((params.endMs - params.startMs) / 1000).toFixed(3)

  await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    startSec,
    '-i',
    params.sourcePath,
    '-t',
    durationSec,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-b:a',
    '64k',
    '-f',
    'mp3',
    params.outputPath,
  ])

  const buf = await readFile(params.outputPath)
  return { sizeBytes: buf.length, hash: sha256Buffer(buf) }
}

export async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function downloadGcsToTemp(params: {
  bucket: { file: (path: string) => { download: (opts: { destination: string }) => Promise<unknown> } }
  storagePath: string
  tempDir: string
  fileName: string
}): Promise<string> {
  const dest = join(params.tempDir, params.fileName)
  await params.bucket.file(params.storagePath).download({ destination: dest })
  return dest
}
