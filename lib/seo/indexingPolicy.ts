/**
 * TenderBriefing indexing policy — route classification for Google Search.
 *
 * INDEXABLE: substantive public procurement pages with standalone value.
 * NOINDEX: authenticated dashboards, transactional flows, and utility routes.
 */

export const INDEXABLE_ROUTE_PREFIXES = [
  '/',
  '/tenders',
  '/pricing',
  '/about',
  '/how-it-works',
  '/support',
  '/contact',
  '/terms',
  '/privacy',
  '/resources',
  '/sme-solutions',
  '/youth-agents',
  '/compulsory-tender-briefings',
  '/tender-briefings-south-africa',
  '/tender-briefing-agent',
  '/tender-briefing-attendance',
  '/rfq-briefing-support',
  '/youth-agent-tender-support',
] as const

/** Routes that must never be indexed — protected by metadata noindex and/or robots disallow. */
export const NOINDEX_ROUTE_CLASSES = {
  founderOps: {
    paths: ['/founder'],
    reason: 'Internal founder operations dashboard',
  },
  adminOps: {
    paths: ['/admin'],
    reason: 'Internal admin operations dashboard',
  },
  agentWorkspace: {
    paths: ['/agent/workspace', '/agent/mobile', '/agent/onboarding'],
    reason: 'Youth Agent authenticated field workspace',
  },
  agentDashboard: {
    paths: ['/agent/dashboard'],
    reason: 'Youth Agent authenticated dashboard',
  },
  smeWorkspace: {
    paths: [
      '/sme/dashboard',
      '/sme/requests',
      '/sme/rfq-inbox',
      '/sme/onboarding',
      '/sme/book-agent',
      '/sme/verify',
    ],
    reason: 'SME authenticated workspace and transactional flows',
  },
  accountSettings: {
    paths: ['/profile', '/settings', '/notifications'],
    reason: 'User account and preference pages',
  },
  authSession: {
    paths: [
      '/auth/signin',
      '/auth/role-selection',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/welcome',
      '/auth/link-account',
    ],
    reason: 'Authentication session flows — signup is intentionally indexable',
  },
  transactionalTender: {
    paths: ['/tenders/*/request-agent'],
    reason: 'Authenticated attendance booking flow tied to a tender',
  },
  api: {
    paths: ['/api'],
    reason: 'JSON API endpoints — not HTML documents',
  },
  pilotFeedback: {
    paths: ['/pilot', '/feedback'],
    reason: 'Pilot programme and feedback collection',
  },
  devTest: {
    paths: ['/dev', '/test', '/*-test'],
    reason: 'Development and QA routes',
  },
} as const
