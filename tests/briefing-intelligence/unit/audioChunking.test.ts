import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DIRECT_MAX_BYTES,
  HARD_MAX_CHUNK_DURATION_MS,
  MAX_CHUNK_COUNT,
  MAX_SOURCE_DURATION_MS,
  TARGET_CHUNK_DURATION_MS,
} from '@/lib/briefing-intelligence/audioChunking/constants'
import { shouldUseChunkedTranscription } from '@/lib/briefing-intelligence/audioChunking/decision'
import { planAudioChunks } from '@/lib/briefing-intelligence/audioChunking/planner'
import {
  assembleChunkTexts,
  mergeAdjacentChunkTexts,
} from '@/lib/briefing-intelligence/audioChunking/overlapMerge'
import { assembleTranscriptFromChunks } from '@/lib/briefing-intelligence/audioChunking/assembleTranscript'
import {
  isBriefingAudioChunkingEnabled,
  isBriefingAudioTranscriptionEnabled,
} from '@/lib/briefing-intelligence/featureFlag'
import type { BriefingAudioChunk } from '@/lib/briefing-intelligence/audioChunking/types'

describe('long-audio chunking decision', () => {
  it('uses direct path when chunking flag is off', () => {
    const r = shouldUseChunkedTranscription({
      chunkingFlagEnabled: false,
      probe: { durationMs: 60 * 60_000, sizeBytes: 50 * 1024 * 1024, codec: 'mp3', bitrateKbps: 128 },
    })
    expect(r.mode).toBe('direct')
  })

  it('uses direct path under size and duration thresholds', () => {
    const r = shouldUseChunkedTranscription({
      chunkingFlagEnabled: true,
      probe: {
        durationMs: 10 * 60_000,
        sizeBytes: 5 * 1024 * 1024,
        codec: 'mp3',
        bitrateKbps: 64,
      },
    })
    expect(r.mode).toBe('direct')
    expect(r.reason).toBe('under_direct_thresholds')
  })

  it('uses chunked path when size exceeds direct threshold', () => {
    const r = shouldUseChunkedTranscription({
      chunkingFlagEnabled: true,
      probe: {
        durationMs: 10 * 60_000,
        sizeBytes: DIRECT_MAX_BYTES + 1,
        codec: 'mp3',
        bitrateKbps: 64,
      },
    })
    expect(r.mode).toBe('chunked')
  })

  it('uses chunked path when duration exceeds direct threshold', () => {
    const r = shouldUseChunkedTranscription({
      chunkingFlagEnabled: true,
      probe: {
        durationMs: HARD_MAX_CHUNK_DURATION_MS,
        sizeBytes: 5 * 1024 * 1024,
        codec: 'mp3',
        bitrateKbps: 64,
      },
    })
    expect(r.mode).toBe('chunked')
  })

  it('rejects audio longer than maximum supported duration', () => {
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
    ).toThrow(/maximum supported duration/)
  })
})

describe('chunk planner', () => {
  it('plans multiple chunks for long duration', () => {
    const plan = planAudioChunks({
      durationMs: 60 * 60_000,
      sizeBytes: 30 * 1024 * 1024,
      codec: 'mp3',
      bitrateKbps: 64,
    })
    expect(plan.length).toBeGreaterThan(1)
    expect(plan[0].index).toBe(0)
    expect(plan[plan.length - 1].endMs).toBe(60 * 60_000)
  })

  it('preserves deterministic ordering', () => {
    const probe = {
      durationMs: 45 * 60_000,
      sizeBytes: 25 * 1024 * 1024,
      codec: 'mp3',
      bitrateKbps: 64,
    }
    const a = planAudioChunks(probe)
    const b = planAudioChunks(probe)
    expect(a.map((p) => p.startMs)).toEqual(b.map((p) => p.startMs))
  })

  it('applies overlap on subsequent chunks', () => {
    const plan = planAudioChunks({
      durationMs: 30 * 60_000,
      sizeBytes: 20 * 1024 * 1024,
      codec: 'mp3',
      bitrateKbps: 64,
    })
    if (plan.length > 1) {
      expect(plan[1].overlapStartMs).not.toBeNull()
    }
  })

  it('bounds chunk count', () => {
    expect(() =>
      planAudioChunks({
        durationMs: MAX_CHUNK_COUNT * TARGET_CHUNK_DURATION_MS + 60_000,
        sizeBytes: 80 * 1024 * 1024,
        codec: 'mp3',
        bitrateKbps: 32,
      })
    ).toThrow(/Chunk count exceeds/)
  })
})

describe('overlap merge', () => {
  it('dedupes overlapping words at chunk boundaries', () => {
    const left = 'The tender closes on Friday next week for all'
    const right = 'next week for all bidders and documents must be submitted'
    const merged = mergeAdjacentChunkTexts(left, right)
    expect(merged).toBe(
      'The tender closes on Friday next week for all bidders and documents must be submitted'
    )
  })

  it('preserves legitimate repeated speech when overlap is short', () => {
    const left = 'Yes yes we agree'
    const right = 'yes we need more time'
    const merged = mergeAdjacentChunkTexts(left, right)
    expect(merged).toContain('Yes yes we agree yes we need more time')
  })

  it('assembles chunks in index order', () => {
    const text = assembleChunkTexts([
      { index: 2, text: 'third' },
      { index: 0, text: 'first' },
      { index: 1, text: 'second' },
    ])
    expect(text).toBe('first second third')
  })
})

function mockChunk(index: number, text: string, startMs: number, endMs: number): BriefingAudioChunk {
  return {
    id: `bac-x-${index}`,
    index,
    startMs,
    endMs,
    overlapStartMs: index > 0 ? startMs : null,
    storagePath: `path/${index}.mp3`,
    audioHash: 'abc',
    sizeBytes: 1000,
    status: 'completed',
    transcriptText: text,
    segments: [
      {
        id: `seg-${index}`,
        speaker: 'Speaker 1',
        startSeconds: 0,
        endSeconds: (endMs - startMs) / 1000,
        text,
      },
    ],
    provider: 'mock',
    providerRequestId: null,
    attempts: 1,
    errorCode: null,
    errorMessage: null,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('transcript assembly', () => {
  it('fails when chunks are incomplete', () => {
    const chunks = [
      mockChunk(0, 'part one', 0, 600_000),
      { ...mockChunk(1, '', 600_000, 1_200_000), status: 'pending' as const, transcriptText: null },
    ]
    expect(() =>
      assembleTranscriptFromChunks({
        chunks,
        sourceDurationMs: 1_200_000,
        provider: 'mock',
        model: null,
      })
    ).toThrow(/Assembly blocked/)
  })

  it('produces single canonical transcript from chunks', () => {
    const chunks = [
      mockChunk(0, 'Opening remarks about the tender', 0, 600_000),
      mockChunk(1, 'Closing requirements and submission', 600_000, 1_200_000),
    ]
    const assembled = assembleTranscriptFromChunks({
      chunks,
      sourceDurationMs: 1_200_000,
      provider: 'mock',
      model: null,
    })
    expect(assembled.fullText).toContain('Opening remarks')
    expect(assembled.fullText).toContain('submission')
    expect(assembled.chunkCount).toBe(2)
    expect(assembled.segments[1].startSeconds).toBeGreaterThan(0)
  })
})

describe('chunking feature flag', () => {
  const prevTrans = process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED
  const prevChunk = process.env.BRIEFING_AUDIO_CHUNKING_ENABLED

  afterEach(() => {
    if (prevTrans === undefined) delete process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED
    else process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED = prevTrans
    if (prevChunk === undefined) delete process.env.BRIEFING_AUDIO_CHUNKING_ENABLED
    else process.env.BRIEFING_AUDIO_CHUNKING_ENABLED = prevChunk
  })

  it('chunking is fail-closed when transcription is disabled', () => {
    process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED = 'false'
    process.env.BRIEFING_AUDIO_CHUNKING_ENABLED = 'true'
    expect(isBriefingAudioTranscriptionEnabled()).toBe(false)
    expect(isBriefingAudioChunkingEnabled()).toBe(false)
  })

  it('chunking requires explicit enable', () => {
    process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED = 'true'
    delete process.env.BRIEFING_AUDIO_CHUNKING_ENABLED
    expect(isBriefingAudioChunkingEnabled()).toBe(false)
    process.env.BRIEFING_AUDIO_CHUNKING_ENABLED = 'true'
    expect(isBriefingAudioChunkingEnabled()).toBe(true)
  })
})
