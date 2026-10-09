/**
 * Email authentication audit for Outreach deliverability.
 * Read-only analysis — never mutates DNS.
 *
 * Findings reflect the production investigation (2026-10-09) plus
 * live Resend domain status when an API key is available.
 */

export type AuthCheckStatus = 'pass' | 'warn' | 'fail' | 'unknown'

export type AuthCheck = {
  id: string
  title: string
  status: AuthCheckStatus
  detail: string
  requiresFounderApprovalToChange: boolean
}

export type AuthAuditReport = {
  auditedAt: string
  fromIdentity: string
  domain: string
  checks: AuthCheck[]
  dnsChangeRecommendations: Array<{
    priority: 'high' | 'medium' | 'low'
    summary: string
    riskIfChanged: string
  }>
  microsoft365Preserved: boolean
  disclaimer: string
}

/** Static production baseline — do not auto-apply DNS. */
export const STATIC_DNS_BASELINE = {
  apexSpf: 'v=spf1 include:spf.protection.outlook.com -all',
  dmarc: 'v=DMARC1; p=none; fo=0; adkim=s; aspf=s',
  dkimHost: 'resend._domainkey.tenderbriefing.co.za',
  returnPathHost: 'send.tenderbriefing.co.za',
  returnPathSpf: 'v=spf1 include:amazonses.com ~all',
  mx: 'tenderbriefing-co-za.mail.protection.outlook.com',
} as const

export function buildStaticAuthAudit(opts?: {
  resendDomainStatus?: string | null
  fromAddress?: string
}): AuthAuditReport {
  const from = opts?.fromAddress || 'TenderBriefing <hello@tenderbriefing.co.za>'
  const resendStatus = String(opts?.resendDomainStatus || 'unknown').toLowerCase()

  const checks: AuthCheck[] = [
    {
      id: 'resend_domain',
      title: 'Resend domain verification',
      status: resendStatus === 'verified' ? 'pass' : resendStatus === 'unknown' ? 'unknown' : 'warn',
      detail:
        resendStatus === 'verified'
          ? 'tenderbriefing.co.za is verified in Resend (eu-west-1).'
          : `Resend domain status: ${resendStatus || 'unknown'}.`,
      requiresFounderApprovalToChange: true,
    },
    {
      id: 'dkim',
      title: 'DKIM (resend._domainkey)',
      status: 'pass',
      detail:
        'TXT resend._domainkey.tenderbriefing.co.za is present and Resend-verified. Expected From/DKIM alignment on tenderbriefing.co.za.',
      requiresFounderApprovalToChange: true,
    },
    {
      id: 'spf_return_path',
      title: 'SPF on Return-Path (send.)',
      status: 'pass',
      detail: `send.tenderbriefing.co.za publishes ${STATIC_DNS_BASELINE.returnPathSpf} and MX to Amazon SES feedback — standard Resend MAIL FROM.`,
      requiresFounderApprovalToChange: true,
    },
    {
      id: 'spf_apex',
      title: 'SPF on apex (mailbox)',
      status: 'pass',
      detail:
        'Apex SPF is Outlook-only (-all). Correct for Microsoft 365 inbound/outbound; must NOT be overwritten with Resend includes without Founder approval.',
      requiresFounderApprovalToChange: true,
    },
    {
      id: 'dmarc',
      title: 'DMARC policy',
      status: 'warn',
      detail:
        'DMARC p=none with strict aspf=s/adkim=s. Strict SPF alignment may fail (MAIL FROM send. vs From @tenderbriefing.co.za) while DKIM can still satisfy DMARC. Monitoring-only policy.',
      requiresFounderApprovalToChange: true,
    },
    {
      id: 'from_identity',
      title: 'Outreach From identity',
      status: from.toLowerCase().includes('hello@tenderbriefing.co.za') ? 'pass' : 'warn',
      detail: `Configured Outreach From: ${from}`,
      requiresFounderApprovalToChange: true,
    },
    {
      id: 'inbox_vs_provider',
      title: 'Provider delivered ≠ inbox placement',
      status: 'warn',
      detail:
        'Resend “delivered” means acceptance by recipient infrastructure, not Gmail Primary. Do not certify inbox placement from provider events alone.',
      requiresFounderApprovalToChange: false,
    },
  ]

  return {
    auditedAt: new Date().toISOString(),
    fromIdentity: from,
    domain: 'tenderbriefing.co.za',
    checks,
    dnsChangeRecommendations: [
      {
        priority: 'medium',
        summary:
          'Consider relaxing DMARC aspf to “r” (relaxed) after review so Return-Path on send. aligns under DMARC SPF, without changing apex Outlook SPF.',
        riskIfChanged:
          'Incorrect DMARC edits can affect Microsoft 365 and third-party senders. Requires Founder approval and staged rollout.',
      },
      {
        priority: 'low',
        summary:
          'After sustained clean metrics, consider raising DMARC from p=none to p=quarantine — only with monitoring and Founder approval.',
        riskIfChanged: 'Can quarantine legitimate mail if alignment breaks.',
      },
    ],
    microsoft365Preserved: true,
    disclaimer:
      'This audit does not modify DNS. Apex Outlook SPF/MX must remain intact. No authentication check guarantees inbox placement.',
  }
}
