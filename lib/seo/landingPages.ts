import type { SeoLandingConfig } from '@/components/seo/SeoLandingPage'

const sharedFaqs = {
  free: {
    question: 'Is TenderBriefing free for SMEs?',
    answer:
      'Yes. Discovering compulsory tender briefings, tracking opportunities and viewing official tender details is completely free for SMEs on TenderBriefing.',
  },
  fee: {
    question: 'When do I pay R249?',
    answer:
      'You only pay the fixed R249 fee when you request a verified Youth Agent to attend a compulsory tender briefing on your behalf. There is no subscription and no charge for browsing tenders.',
  },
}

export const SEO_LANDING_PAGES: Record<string, SeoLandingConfig> = {
  'tender-briefings-south-africa': {
    path: '/tender-briefings-south-africa',
    eyebrow: 'South Africa · Procurement',
    title: 'Tender Briefings South Africa',
    heroDescription:
      'Find compulsory government tender briefings across all nine provinces. TenderBriefing helps South African SMEs track official eTenders opportunities and request Youth Agents when attendance is required.',
    intro:
      'TenderBriefing is a South African procurement platform focused on compulsory tender briefings. We sync official National Treasury eTenders data so SMEs can see briefing dates, closing dates, documents and scope of work without missing compliance deadlines.',
    highlights: [
      'Official eTenders sync for government procurement opportunities',
      'Compulsory briefing dates, times and venues in one place',
      'Free tender discovery for registered SMEs',
      'Verified Youth Agents available when you cannot attend in person',
    ],
    features: [
      {
        title: 'Nationwide coverage',
        text: 'Browse compulsory briefings from national departments, municipalities, SOEs and provincial entities across South Africa.',
      },
      {
        title: 'Briefing intelligence',
        text: 'See official tender descriptions, documents, contact details and key dates exactly as published on eTenders.',
      },
      {
        title: 'Agent support',
        text: 'Request a Youth Agent for R249 when a briefing is compulsory and you cannot attend — receive a structured briefing report.',
      },
      {
        title: 'Built for SMEs',
        text: 'No complex subscriptions. Register free, track opportunities and only pay when you need physical briefing attendance support.',
      },
    ],
    faqs: [
      sharedFaqs.free,
      sharedFaqs.fee,
      {
        question: 'What is a tender briefing in South Africa?',
        answer:
          'A tender briefing is a meeting where a procuring entity explains a government tender opportunity. When marked compulsory, bidders who do not attend may have their submissions disqualified.',
      },
      {
        question: 'Does TenderBriefing replace eTenders?',
        answer:
          'No. TenderBriefing surfaces and organises official eTenders data with a focus on compulsory briefings and SME-friendly tools. You still submit bids through official channels.',
      },
    ],
    ctaTitle: 'Start discovering tender briefings across South Africa',
    ctaDescription:
      'Create a free SME account and browse live compulsory briefing opportunities synced from official government sources.',
    relatedLinks: [
      { href: '/compulsory-tender-briefings', label: 'Compulsory briefings' },
      { href: '/tenders/gauteng', label: 'Gauteng tenders' },
      { href: '/how-it-works', label: 'How it works' },
    ],
  },
  'compulsory-tender-briefings': {
    path: '/compulsory-tender-briefings',
    eyebrow: 'Compliance · Briefings',
    title: 'Compulsory Tender Briefings',
    heroDescription:
      'Never miss a compulsory tender briefing again. TenderBriefing tracks government tenders where attendance is mandatory and helps SMEs request verified agents when they cannot attend.',
    intro:
      'Many South African government tenders require compulsory briefing or site meeting attendance. Missing these sessions can disqualify your bid before evaluation even begins. TenderBriefing filters and highlights these opportunities so SMEs can plan ahead.',
    highlights: [
      'Focus on tenders with compulsory briefing requirements',
      'Briefing date, time and venue clearly displayed',
      'Official tender scope and documents linked from eTenders',
      'Youth Agent attendance support for R249 per briefing',
    ],
    features: [
      {
        title: 'Compliance visibility',
        text: 'Quickly identify which opportunities require physical or virtual briefing attendance before you invest in a bid.',
      },
      {
        title: 'Deadline alerts',
        text: 'See briefing countdowns alongside closing dates so your team can prepare documents and attendance plans early.',
      },
      {
        title: 'Agent dispatch',
        text: 'When travel or schedules block attendance, request a verified Youth Agent to represent your business at the briefing.',
      },
      {
        title: 'Briefing reports',
        text: 'Receive structured notes from the session to help your bid team understand requirements and risks.',
      },
    ],
    faqs: [
      sharedFaqs.free,
      sharedFaqs.fee,
      {
        question: 'What happens if I miss a compulsory briefing?',
        answer:
          'For many tenders, failure to attend a compulsory briefing results in automatic disqualification. Always confirm requirements in the official tender documents.',
      },
      {
        question: 'Can someone attend the briefing for my company?',
        answer:
          'Yes — through TenderBriefing you can request a verified Youth Agent to attend on your behalf for a fixed R249 fee, subject to availability and tender rules.',
      },
    ],
    ctaTitle: 'Track compulsory briefings before deadlines pass',
    ctaDescription:
      'Register free and browse live compulsory briefing opportunities on TenderBriefing.',
    relatedLinks: [
      { href: '/tender-briefing-attendance', label: 'Briefing attendance' },
      { href: '/tender-briefing-agent', label: 'Tender briefing agent' },
      { href: '/tenders', label: 'All tenders' },
    ],
  },
  'tender-briefing-agent': {
    path: '/tender-briefing-agent',
    eyebrow: 'Youth Agents · R249',
    title: 'Tender Briefing Agent',
    heroDescription:
      'Request a verified Youth Agent to attend a compulsory tender briefing on your behalf for a fixed R249. Free tender discovery — pay only when you need attendance support.',
    intro:
      'TenderBriefing connects SMEs with verified Youth Agents who can attend compulsory tender briefings when owners or bid teams cannot be there in person. Discovery is free; the R249 fee applies only when you confirm an agent request.',
    highlights: [
      'Verified Youth Agents nationwide',
      'Fixed R249 per compulsory briefing attendance',
      'Structured briefing report after the session',
      'WhatsApp and in-app status updates',
    ],
    features: [
      {
        title: 'Simple request flow',
        text: 'Find a compulsory briefing on TenderBriefing, review the official scope and request an agent in a few steps.',
      },
      {
        title: 'Transparent pricing',
        text: 'No hidden fees or subscriptions — R249 only when you choose agent attendance support.',
      },
      {
        title: 'Attendance proof',
        text: 'Agents capture key instructions, risks and submission requirements from the official briefing session.',
      },
      {
        title: 'SME-first design',
        text: 'Built for small businesses competing for government contracts without large compliance teams.',
      },
    ],
    faqs: [
      sharedFaqs.free,
      sharedFaqs.fee,
      {
        question: 'Who are Youth Agents on TenderBriefing?',
        answer:
          'Youth Agents are verified representatives who attend compulsory briefings on behalf of SMEs and return structured session notes to support compliant bidding.',
      },
      {
        question: 'Is the R249 fee per tender or per month?',
        answer: 'Per briefing attendance request — not a monthly subscription.',
      },
    ],
    ctaTitle: 'Request a tender briefing agent when you need one',
    ctaDescription:
      'Browse compulsory briefings free, then request a Youth Agent for R249 when attendance is required.',
    relatedLinks: [
      { href: '/youth-agent-tender-support', label: 'Youth agent support' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/how-it-works', label: 'How it works' },
    ],
  },
  'tender-briefing-attendance': {
    path: '/tender-briefing-attendance',
    eyebrow: 'Attendance · Compliance',
    title: 'Tender Briefing Attendance',
    heroDescription:
      'Plan compulsory tender briefing attendance with confidence. TenderBriefing shows dates, times, venues and documents — and connects SMEs to Youth Agents when they cannot attend.',
    intro:
      'Successful bidding starts with showing up. TenderBriefing helps SMEs manage compulsory briefing attendance by centralising official dates, locations and tender scope, with optional Youth Agent support when travel or capacity is limited.',
    highlights: [
      'Briefing date and time on every tender detail page',
      'Venue and virtual meeting links where published',
      'Official tender documents from eTenders',
      'Optional agent attendance for R249',
    ],
    features: [
      {
        title: 'Calendar-ready dates',
        text: 'Add compulsory briefings to your calendar directly from the tender detail page.',
      },
      {
        title: 'Venue clarity',
        text: 'See physical venues or Teams/Zoom links as published by the procuring entity.',
      },
      {
        title: 'Document access',
        text: 'Download official tender PDFs and attachments synced from eTenders.',
      },
      {
        title: 'Backup attendance',
        text: 'Request a Youth Agent when your team cannot attend a compulsory session.',
      },
    ],
    faqs: [
      sharedFaqs.free,
      sharedFaqs.fee,
      {
        question: 'Are virtual compulsory briefings supported?',
        answer:
          'Yes. When eTenders publishes an online meeting link, TenderBriefing displays it on the tender detail page alongside date and time.',
      },
    ],
    ctaTitle: 'Never miss a compulsory briefing date',
    ctaDescription: 'Register free and track briefing attendance requirements across South Africa.',
    relatedLinks: [
      { href: '/compulsory-tender-briefings', label: 'Compulsory briefings' },
      { href: '/tenders', label: 'View tenders' },
    ],
  },
  'rfq-briefing-support': {
    path: '/rfq-briefing-support',
    eyebrow: 'RFQ · SMEs',
    title: 'RFQ Briefing Support',
    heroDescription:
      'Support for RFQ and tender briefing compliance in South Africa. Discover opportunities, track compulsory sessions and request Youth Agents when needed — free for SMEs.',
    intro:
      'Request for Quotation (RFQ) and formal tender processes often include briefing or clarification sessions. TenderBriefing helps SMEs track these requirements, access official documents and request attendance support without paying for discovery.',
    highlights: [
      'RFQs and open tenders with briefing requirements',
      'Official scope text as published on eTenders',
      'Free SME registration and tender tracking',
      'R249 agent fee only when attendance support is requested',
    ],
    features: [
      {
        title: 'RFQ visibility',
        text: 'See RFQs alongside formal tenders when briefing or compliance details are published.',
      },
      {
        title: 'Scope clarity',
        text: 'Read the official tender description exactly as issued by the procuring entity.',
      },
      {
        title: 'Private RFQ inbox',
        text: 'Registered SMEs can also manage private RFQ opportunities sent directly to their business.',
      },
      {
        title: 'Agent backup',
        text: 'Use Youth Agents when RFQ briefings clash with your operations schedule.',
      },
    ],
    faqs: [
      sharedFaqs.free,
      sharedFaqs.fee,
      {
        question: 'Does TenderBriefing handle private RFQs?',
        answer:
          'Yes. Registered SMEs can receive and manage private RFQ opportunities in addition to public eTenders compulsory briefings.',
      },
    ],
    ctaTitle: 'Get RFQ briefing support on your terms',
    ctaDescription: 'Free discovery. Fixed R249 only when you request a Youth Agent for attendance.',
    relatedLinks: [
      { href: '/tender-briefing-agent', label: 'Briefing agent' },
      { href: '/resources', label: 'Resources' },
    ],
  },
  'youth-agent-tender-support': {
    path: '/youth-agent-tender-support',
    eyebrow: 'Youth Agents · Earn',
    title: 'Youth Agent Tender Support',
    heroDescription:
      'Verified Youth Agents help South African SMEs attend compulsory tender briefings. SMEs browse free; agents earn by representing businesses at official briefing sessions.',
    intro:
      'TenderBriefing creates economic opportunity for youth while solving a real SME problem — compulsory briefing attendance. SMEs use the platform free and pay R249 only when requesting an agent. Youth Agents register separately to receive briefing assignments.',
    highlights: [
      'Nationwide agent network for briefing attendance',
      'SMEs pay R249 only when requesting an agent',
      'Structured reporting after each briefing session',
      'Official eTenders data drives dispatch and matching',
    ],
    features: [
      {
        title: 'For SMEs',
        text: 'Register free, find compulsory briefings and request an agent when you cannot attend in person.',
      },
      {
        title: 'For Youth Agents',
        text: 'Apply as a youth agent, complete verification and accept briefing assignments in your province.',
      },
      {
        title: 'Quality assurance',
        text: 'Attendance proof, session notes and SLA tracking protect SMEs and maintain platform trust.',
      },
      {
        title: 'Shared value',
        text: 'SMEs stay compliant; youth gain work experience in the procurement economy.',
      },
    ],
    faqs: [
      sharedFaqs.free,
      sharedFaqs.fee,
      {
        question: 'How do I become a Youth Agent?',
        answer:
          'Register as a youth agent on TenderBriefing, complete onboarding and verification, then accept assignments through the agent dashboard.',
      },
      {
        question: 'Do agents pay to join?',
        answer:
          'Youth Agents register through a separate onboarding flow. SMEs never pay to browse tenders — only when requesting agent attendance.',
      },
    ],
    ctaTitle: 'Join as an SME or Youth Agent',
    ctaDescription:
      'SMEs register free to browse briefings. Youth Agents apply to support compulsory briefing attendance nationwide.',
    relatedLinks: [
      { href: '/auth/signup?type=youth-agent', label: 'Agent signup' },
      { href: '/youth-agents', label: 'About youth agents' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
}

export const SEO_LANDING_PATHS = Object.keys(SEO_LANDING_PAGES)
