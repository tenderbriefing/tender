import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { Headers } from 'undici'

import {
  MockTranscriptionProvider,
  OpenAITranscriptionProvider,
} from '../../../lib/briefing-intelligence/transcriptionService'

describe('Briefing Intelligence transcriptionService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mock provider returns structured output', async () => {
    const provider = new MockTranscriptionProvider()
    const tenderContext = {
      // MockTranscriptionProvider uses tenderContext.reportId directly.
      reportId: 'TB-BR-ABC123',
      tenderTitle: 'Tender title',
      tenderReference: 'TN-1',
      issuingEntity: 'Dept',
      briefingDate: '2026-08-10',
      briefingVenue: 'Johannesburg',
      description: 'A tender description',
      closingDate: null,
      estimatedValue: null,
      category: null,
      province: null,
    }

    const out = await provider.extractIntelligence('MOCK_TRANSCRIPT', tenderContext as any)
    expect(out.coverHeader.reportId).toMatch(/^TB-BR-[A-Z0-9]{6}$/)
    expect(out.coverHeader.tenderTitle).toBe(tenderContext.tenderTitle)
    expect(out.executiveSummary.summary).toMatch(/MOCK DRAFT/i)
    expect(Array.isArray(out.keyRequirements)).toBe(true)
    expect(Array.isArray(out.clarifications)).toBe(true)
    expect(out.reportCertification.reportVersion).toBeTruthy()
    expect(out.reportCertification.certifiedBy).toBeTruthy()
  })

  it('schema validation catches invalid extraction', async () => {
    const provider = new OpenAITranscriptionProvider({ apiKey: 'sk-test' })
    const tenderContext = {
      tenderTitle: 'Tender title',
      tenderReference: 'TN-1',
      issuingEntity: 'Dept',
      briefingDate: '2026-08-10',
      briefingVenue: 'Johannesburg',
      description: 'A tender description',
      closingDate: null,
      estimatedValue: null,
      category: null,
      province: null,
    }

    const invalidExtracted = {
      // Missing many required keys (e.g. coverHeader.reportDate and full schema)
      coverHeader: {
        reportId: 'TB-BR-ABCDEF',
        tenderTitle: 'Tender title',
      },
    }

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/chat/completions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify(invalidExtracted) } }],
          }),
        }
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    ;(globalThis as any).fetch = fetchMock

    await expect(provider.extractIntelligence('transcript text', tenderContext as any)).rejects.toThrow(
      /schema validation/i
    )
  })

  it('handles null/unknown states (language + confidence) from transcription', async () => {
    const provider = new OpenAITranscriptionProvider({ apiKey: 'sk-test' })

    const fetchMock = vi.fn(async (url: string) => {
      // Step 1: download audio from signed URL
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }

      // Step 2: call OpenAI transcription endpoint
      if (url.includes('/audio/transcriptions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            text: 'hello world',
            // language omitted to trigger null behavior
          }),
        }
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })

    ;(globalThis as any).fetch = fetchMock

    const res = await provider.transcribe('https://signed.example/audio.mp3')
    expect(res.provider).toBe('openai-whisper')
    expect(res.transcriptText).toBe('hello world')
    expect(res.transcriptWordCount).toBe(2)
    expect(res.language).toBeNull()
    expect(res.confidence).toBeNull()
    expect(res.completedAt).toBeTruthy()
    expect(res.segments.length).toBeGreaterThanOrEqual(1)
    expect(res.segments[0].speaker).toBe('Speaker 1')
    expect(res.segments[0].text).toBe('hello world')
  })

  it('preserves timestamped segments from verbose_json without inventing speaker names', async () => {
    const provider = new OpenAITranscriptionProvider({ apiKey: 'sk-test' })

    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }
      if (url.includes('/audio/transcriptions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            text: 'Hello there. More words.',
            language: 'en',
            duration: 10.5,
            segments: [
              { start: 0, end: 4.2, text: ' Hello there.' },
              { start: 4.2, end: 10.5, text: ' More words.' },
            ],
          }),
        }
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    ;(globalThis as any).fetch = fetchMock

    const res = await provider.transcribe('https://signed.example/audio.mp3')
    expect(res.segments).toHaveLength(2)
    expect(res.segments[0].startSeconds).toBe(0)
    expect(res.segments[0].endSeconds).toBe(4.2)
    expect(res.segments[0].speaker).toBe('Speaker 1')
    expect(res.segments[1].speaker).toBe('Speaker 1')
    expect(res.durationSeconds).toBe(10.5)
    expect(res.language).toBe('en')
  })

  it('mock closing-date fixture includes speaker-separated timestamps', async () => {
    const provider = new MockTranscriptionProvider()
    const res = await provider.transcribe('https://example/closingdate-extended-12-19.mp3')
    expect(res.segments.length).toBeGreaterThanOrEqual(2)
    expect(res.segments.some((s) => s.speaker === 'Speaker 2')).toBe(true)
    expect(res.transcriptText).toMatch(/19 September 2026/)
  })

  it('never generates extraction when transcription returns empty text', async () => {
    const provider = new OpenAITranscriptionProvider({ apiKey: 'sk-test' })

    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }
      if (url.includes('/audio/transcriptions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ text: '   ' }),
        }
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    ;(globalThis as any).fetch = fetchMock

    await expect(provider.transcribe('https://signed.example/audio.mp3')).rejects.toThrow(
      /empty text/i
    )
  })
})

