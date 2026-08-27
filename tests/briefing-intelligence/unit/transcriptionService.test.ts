import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { Headers } from 'undici'
import {
  MockTranscriptionProvider,
  OpenAITranscriptionProvider,
  getTranscriptionProvider,
} from '../../../lib/briefing-intelligence/transcriptionService'
import {
  SpeechmaticsTranscriptionProvider,
  mapSpeechmaticsTranscript,
} from '../../../lib/briefing-intelligence/speechmaticsTranscriptionProvider'
import {
  isBriefingAudioChunkingEnabled,
  isBriefingAudioTranscriptionEnabled,
} from '../../../lib/briefing-intelligence/featureFlag'
import { shouldUseChunkedTranscription } from '../../../lib/briefing-intelligence/audioChunking/decision'

describe('Briefing Intelligence transcriptionService', () => {
  const prevProvider = process.env.BRIEFING_INTELLIGENCE_PROVIDER
  const prevSpeechKey = process.env.SPEECHMATICS_API_KEY
  const prevOpenaiKey = process.env.OPENAI_API_KEY
  const prevChunking = process.env.BRIEFING_AUDIO_CHUNKING_ENABLED
  const prevTranscription = process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED

  afterEach(() => {
    vi.restoreAllMocks()
    if (prevProvider === undefined) delete process.env.BRIEFING_INTELLIGENCE_PROVIDER
    else process.env.BRIEFING_INTELLIGENCE_PROVIDER = prevProvider
    if (prevSpeechKey === undefined) delete process.env.SPEECHMATICS_API_KEY
    else process.env.SPEECHMATICS_API_KEY = prevSpeechKey
    if (prevOpenaiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = prevOpenaiKey
    if (prevChunking === undefined) delete process.env.BRIEFING_AUDIO_CHUNKING_ENABLED
    else process.env.BRIEFING_AUDIO_CHUNKING_ENABLED = prevChunking
    if (prevTranscription === undefined) delete process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED
    else process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED = prevTranscription
  })

  it('mock provider returns structured output', async () => {
    const provider = new MockTranscriptionProvider()
    const tenderContext = {
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

  it('OpenAI provider refuses Whisper transcription (retired)', async () => {
    const provider = new OpenAITranscriptionProvider({ apiKey: 'sk-test' })
    await expect(provider.transcribe('https://signed.example/audio.mp3')).rejects.toThrow(
      /Whisper transcription has been retired/i
    )
  })

  it('mock closing-date fixture includes speaker-separated timestamps', async () => {
    const provider = new MockTranscriptionProvider()
    const res = await provider.transcribe('https://example/closingdate-extended-12-19.mp3')
    expect(res.segments.length).toBeGreaterThanOrEqual(2)
    expect(res.segments.some((s) => s.speaker === 'Speaker 2')).toBe(true)
    expect(res.transcriptText).toMatch(/19 September 2026/)
  })
})

describe('Speechmatics provider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps json-v2 words into neutral speaker segments', () => {
    const mapped = mapSpeechmaticsTranscript({
      metadata: { duration: 3.5, transcript: 'Hello world.' },
      results: [
        {
          type: 'word',
          start_time: 0,
          end_time: 0.5,
          alternatives: [{ content: 'Hello', confidence: 0.9, speaker: 'S1' }],
        },
        {
          type: 'word',
          start_time: 0.6,
          end_time: 1.0,
          alternatives: [{ content: 'world', confidence: 0.8, speaker: 'S1' }],
        },
        {
          type: 'punctuation',
          start_time: 1.0,
          end_time: 1.0,
          alternatives: [{ content: '.', confidence: 1, speaker: 'S1' }],
        },
        {
          type: 'word',
          start_time: 1.2,
          end_time: 1.8,
          alternatives: [{ content: 'Next', confidence: 0.7, speaker: 'S2' }],
        },
      ],
    })
    expect(mapped.transcriptText).toMatch(/Hello/)
    expect(mapped.segments[0].speaker).toBe('Speaker 1')
    expect(mapped.segments.some((s) => s.speaker === 'Speaker 2')).toBe(true)
  })

  it('rejects empty Speechmatics transcript payloads', () => {
    expect(() => mapSpeechmaticsTranscript({ metadata: {}, results: [] })).toThrow(/empty text/i)
  })

  it('requires SPEECHMATICS_API_KEY when constructing provider', () => {
    const prev = process.env.SPEECHMATICS_API_KEY
    delete process.env.SPEECHMATICS_API_KEY
    expect(() => new SpeechmaticsTranscriptionProvider()).toThrow(/SPEECHMATICS_API_KEY/i)
    if (prev === undefined) delete process.env.SPEECHMATICS_API_KEY
    else process.env.SPEECHMATICS_API_KEY = prev
  })

  it('forms Batch job request with Bearer auth and multipart config', async () => {
    const provider = new SpeechmaticsTranscriptionProvider({ apiKey: 'sm-test-key' })
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }
      if (url.includes('/v2/jobs') && init?.method === 'POST') {
        expect(init.headers.Authorization).toBe('Bearer sm-test-key')
        expect(String(init.headers.Authorization)).not.toMatch(/sk-/)
        expect(init.body).toBeTruthy()
        return { ok: true, status: 201, json: async () => ({ id: 'job-1' }) }
      }
      if (url.includes('/transcript')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            metadata: { duration: 2, transcript: 'Hello world' },
            results: [
              {
                type: 'word',
                start_time: 0,
                end_time: 1,
                alternatives: [{ content: 'Hello', confidence: 1, speaker: 'S1' }],
              },
              {
                type: 'word',
                start_time: 1,
                end_time: 2,
                alternatives: [{ content: 'world', confidence: 1, speaker: 'S1' }],
              },
            ],
          }),
        }
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })
    ;(globalThis as any).fetch = fetchMock
    const res = await provider.transcribe('https://signed.example/audio.mp3')
    expect(res.provider).toBe('speechmatics')
    expect(res.transcriptText).toMatch(/Hello/)
    expect(res.rawProviderPayload).toMatchObject({ jobId: 'job-1' })
    expect(fetchMock).toHaveBeenCalled()
    // No Whisper endpoint on Speechmatics path.
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes('/audio/transcriptions'))
    ).toBe(false)
  })

  it('fails on Speechmatics auth errors', async () => {
    const provider = new SpeechmaticsTranscriptionProvider({ apiKey: 'bad-key' })
    ;(globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }
      if (init?.method === 'POST') {
        return { ok: false, status: 401, text: async () => 'unauthorized' }
      }
      throw new Error(`Unexpected ${url}`)
    })
    await expect(provider.transcribe('https://signed.example/audio.mp3')).rejects.toThrow(
      /Speechmatics job create failed: 401/i
    )
  })

  it('fails on rate-limit / provider errors', async () => {
    const provider = new SpeechmaticsTranscriptionProvider({ apiKey: 'sm-test' })
    ;(globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }
      if (init?.method === 'POST') {
        return { ok: false, status: 429, text: async () => 'rate limited' }
      }
      throw new Error(`Unexpected ${url}`)
    })
    await expect(provider.transcribe('https://signed.example/audio.mp3')).rejects.toThrow(/429/)
  })

  it('fails on network/timeout errors without inventing a transcript', async () => {
    const provider = new SpeechmaticsTranscriptionProvider({ apiKey: 'sm-test' })
    ;(globalThis as any).fetch = vi.fn(async (url: string) => {
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }
      throw new Error('network timeout')
    })
    await expect(provider.transcribe('https://signed.example/audio.mp3')).rejects.toThrow(
      /network timeout/i
    )
  })

  it('fails on invalid Speechmatics job create response (missing id)', async () => {
    const provider = new SpeechmaticsTranscriptionProvider({ apiKey: 'sm-test' })
    ;(globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }
      if (init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({}) }
      }
      throw new Error(`Unexpected ${url}`)
    })
    await expect(provider.transcribe('https://signed.example/audio.mp3')).rejects.toThrow(
      /no id/i
    )
  })

  it('fails when transcript endpoint returns empty text after job create', async () => {
    const provider = new SpeechmaticsTranscriptionProvider({ apiKey: 'sm-test' })
    ;(globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://signed.example/audio.mp3') {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        }
      }
      if (init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ id: 'job-empty' }) }
      }
      if (url.includes('/transcript')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ metadata: { transcript: '   ' }, results: [] }),
        }
      }
      throw new Error(`Unexpected ${url}`)
    })
    await expect(provider.transcribe('https://signed.example/audio.mp3')).rejects.toThrow(
      /empty text/i
    )
  })
})

describe('provider selection', () => {
  const prevProvider = process.env.BRIEFING_INTELLIGENCE_PROVIDER
  const prevSpeech = process.env.SPEECHMATICS_API_KEY
  const prevOpenai = process.env.OPENAI_API_KEY

  beforeEach(() => {
    process.env.SPEECHMATICS_API_KEY = 'sm-test'
    process.env.OPENAI_API_KEY = 'sk-test'
  })

  afterEach(() => {
    if (prevProvider === undefined) delete process.env.BRIEFING_INTELLIGENCE_PROVIDER
    else process.env.BRIEFING_INTELLIGENCE_PROVIDER = prevProvider
    if (prevSpeech === undefined) delete process.env.SPEECHMATICS_API_KEY
    else process.env.SPEECHMATICS_API_KEY = prevSpeech
    if (prevOpenai === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = prevOpenai
  })

  it('defaults to Speechmatics when provider unset', () => {
    delete process.env.BRIEFING_INTELLIGENCE_PROVIDER
    expect(getTranscriptionProvider()).toBeInstanceOf(SpeechmaticsTranscriptionProvider)
  })

  it('selects Speechmatics explicitly', () => {
    process.env.BRIEFING_INTELLIGENCE_PROVIDER = 'speechmatics'
    expect(getTranscriptionProvider()).toBeInstanceOf(SpeechmaticsTranscriptionProvider)
  })

  it('rejects openai and whisper as retired transcription providers', () => {
    process.env.BRIEFING_INTELLIGENCE_PROVIDER = 'openai'
    expect(() => getTranscriptionProvider()).toThrow(/retired/i)
    process.env.BRIEFING_INTELLIGENCE_PROVIDER = 'whisper'
    expect(() => getTranscriptionProvider()).toThrow(/retired/i)
  })

  it('selects mock provider', () => {
    process.env.BRIEFING_INTELLIGENCE_PROVIDER = 'mock'
    expect(getTranscriptionProvider()).toBeInstanceOf(MockTranscriptionProvider)
  })

  it('fails clearly on invalid provider values', () => {
    process.env.BRIEFING_INTELLIGENCE_PROVIDER = 'speachmatics'
    expect(() => getTranscriptionProvider()).toThrow(/Invalid BRIEFING_INTELLIGENCE_PROVIDER/i)
  })
})

describe('chunking remains fail-closed with Speechmatics default', () => {
  afterEach(() => {
    delete process.env.BRIEFING_AUDIO_CHUNKING_ENABLED
    delete process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED
  })

  it('chunking disabled when flag absent even if transcription enabled', () => {
    process.env.BRIEFING_AUDIO_TRANSCRIPTION_ENABLED = 'true'
    delete process.env.BRIEFING_AUDIO_CHUNKING_ENABLED
    expect(isBriefingAudioTranscriptionEnabled()).toBe(true)
    expect(isBriefingAudioChunkingEnabled()).toBe(false)
    const decision = shouldUseChunkedTranscription({
      chunkingFlagEnabled: false,
      probe: {
        durationMs: 60 * 60_000,
        sizeBytes: 50 * 1024 * 1024,
        codec: 'mp3',
        bitrateKbps: 64,
      },
    })
    expect(decision.mode).toBe('direct')
  })
})
