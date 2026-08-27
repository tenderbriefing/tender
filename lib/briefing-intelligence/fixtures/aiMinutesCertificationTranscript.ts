/**
 * Deterministic certification transcript for AI minutes (no live customer delivery).
 * Marker: ai-minutes-cert-fixture
 */
export const AI_MINUTES_CERT_MARKER = 'ai-minutes-cert-fixture'

export const AI_MINUTES_CERT_TRANSCRIPT = `
[${AI_MINUTES_CERT_MARKER}]
Official: Good morning. Welcome to the compulsory briefing for facilities maintenance at the Pretoria campus.
Official: CIDB Grade 4GB or higher is mandatory. A valid COIDA letter of good standing is required with the bid.
Official: Site access is restricted after 16:00. Service lifts in Block B are currently out of service.
Official: Bids must be submitted via the eTender portal. Bring a hard-copy original plus two copies to the tender office.
Official: The closing date remains 15 October 2026 at 11:00. The compulsory site inspection is on 20 September 2026.

Bidder: Will the closing date be extended?
Official: No. The closing date remains 15 October 2026 at 11:00. No extension is currently planned.

Bidder: Is a joint venture allowed for the CIDB grade requirement?
Official: Yes. A compliant joint venture may meet the CIDB Grade 4GB requirement if the JV certificate demonstrates the combined grading.

Bidder: Will parking for contractor vehicles be provided on site?
Official: We will get back to you on that. [no definitive answer recorded]

Official: I think the bond is 10%, but please check the tender document because I am not certain.

Note: Local-content percentage thresholds were not discussed in the recorded briefing.
`.trim()

export const AI_MINUTES_CERT_SEGMENTS = [
  {
    id: 'seg-tech-1',
    startSeconds: 60,
    endSeconds: 90,
    text: 'Site access is restricted after 16:00. Service lifts in Block B are currently out of service.',
  },
  {
    id: 'seg-qa-1',
    startSeconds: 120,
    endSeconds: 150,
    text: 'Will the closing date be extended? Closing date remains 15 October 2026 at 11:00.',
  },
  {
    id: 'seg-qa-2',
    startSeconds: 160,
    endSeconds: 190,
    text: 'Is a joint venture allowed for the CIDB grade requirement?',
  },
  {
    id: 'seg-qa-3',
    startSeconds: 200,
    endSeconds: 220,
    text: 'Will parking for contractor vehicles be provided on site?',
  },
  {
    id: 'seg-uncertain-1',
    startSeconds: 230,
    endSeconds: 250,
    text: 'I think the bond is 10%, but please check the tender document because I am not certain.',
  },
]

export const AI_MINUTES_CERT_METADATA = {
  tenderTitle: 'Facilities Maintenance — Pretoria Campus',
  tenderNumber: 'DPW-FM-2026-09',
  department: 'Department of Public Works',
  briefingDate: '2026-09-10',
  briefingVenue: 'Pretoria Campus Auditorium',
  closingDate: '2026-10-15',
  closingTime: '11:00',
  requiresBriefingCertificate: true,
}
