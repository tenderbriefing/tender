import type { SeoLandingConfig } from '@/lib/seo/landingTypes'
import {
  AGENT_DELEGATION_FAQ,
  COMPULSORY_DISQUALIFICATION_FAQ,
  ETENDERS_FAQ,
  R249_FAQ,
  SME_FREE_FAQ,
} from './shared'

export const attendanceConfig: SeoLandingConfig = {
  slug: 'tender-briefing-attendance',
  path: '/tender-briefing-attendance',
  metaDescription:
    'Plan compulsory tender briefing attendance with dates, venues, virtual links and calendar exports. TenderBriefing helps South African SMEs comply — free discovery, R249 Youth Agent backup when you cannot attend.',
  eyebrow: 'Attendance · Calendar planning',
  title: 'Tender Briefing Attendance Planning',
  heroDescription:
    'Successful government bids start with showing up. TenderBriefing centralises compulsory briefing dates, times, venues and virtual meeting links — plus Youth Agent backup when your team cannot attend the official session.',
  heroPrimaryCta: 'Plan my briefing calendar',
  heroSecondaryCta: 'See upcoming briefings',
  intro:
    'Tender briefing attendance is where compliance meets operations. You may have the right B-BBEE credentials, pricing and technical capacity — but if no authorised representative appears at the compulsory session, your submission can be set aside unread. TenderBriefing helps South African SMEs treat attendance as a first-class project milestone: visible on every tender detail page alongside closing dates, exportable to calendar tools, and backed by Youth Agents when directors are double-booked or out of province.',
  sections: [
    {
      heading: 'Physical versus virtual attendance',
      paragraphs: [
        'Physical briefings often occur at project sites — schools, clinics, depots, municipal yards — where safety induction, ID checks and PPE are mandatory. Virtual briefings grew across national and provincial departments using Microsoft Teams or Zoom links published on eTenders.',
        'TenderBriefing displays venue text and meeting links exactly as synced from official records, with briefing time included where published. SMEs should not assume all briefings are virtual; always read the PDF for attendance mode and registration steps.',
        'Hybrid confusion causes disqualifications — teams join a Teams link that was optional while the compulsory component was a site visit. Cross-check documents and TenderBriefing detail pages together.',
      ],
    },
    {
      heading: 'Calendar discipline for bid teams',
      paragraphs: [
        'Treat briefing date as hard constraint and closing date as dependent milestone. Internal workflows should block estimator time only after attendance is confirmed or delegated to an agent.',
        'TenderBriefing tender detail pages support calendar export for briefing and closing events — reducing reliance on manual entry errors that cause missed hours or wrong time zones.',
        'Share tender URLs in your team chat so attendance responsibility is explicit: one named person, one backup, one agent request if both fail.',
      ],
    },
    {
      heading: 'Registering and proving attendance',
      paragraphs: [
        'Most entities maintain sign-in registers at briefings. Your company name must match eTenders registration; some tenders require letter of authority for representatives.',
        'Keep proof — register stamp, email confirmation, agent attendance report — in the bid file. Opening committees occasionally query briefing compliance before evaluation.',
        'Youth Agents follow the same registration process on your behalf when delegation is permitted, returning evidence through TenderBriefing.',
      ],
    },
    {
      heading: 'When to escalate to Youth Agent attendance',
      paragraphs: [
        'Escalate when travel exceeds sensible bid budget, when leadership is unavailable, or when two compulsory sessions collide. R249 agent attendance is designed for these operational realities — not as replacement for every briefing.',
        'Agents are particularly useful for first-time site visits in unfamiliar provinces where missing subtle access rules would underprice logistics.',
        'Discovery remains free; you only pay when confirming agent support for a specific compulsory session.',
      ],
    },
    {
      heading: 'After the briefing: turning attendance into bid quality',
      paragraphs: [
        'Attendance without notes wastes time. Capture clarifications, risks, addenda references and contact persons while details are fresh — or rely on structured agent reports.',
        'Update your compliance checklist: briefing attended, documents revised for addenda, pricing reflects site conditions, submission method confirmed on eTenders.',
        'TenderBriefing keeps documents and dates visible post-briefing so your team does not revert to outdated PDF versions.',
      ],
    },
  ],
  authority: {
    heading: 'Why attendance planning separates winning SMEs from disqualified bids',
    paragraphs: [
      'Evaluation committees see attendance compliance as binary. TenderBriefing exists because SMEs lose fair opportunities on logistics — not capability. Centralising dates, venues, links and optional agents converts procurement rules into manageable operations.',
      'Combined with resources on compulsory briefings and regional tender pages, attendance planning becomes a repeatable company process instead of a panic response to each advert.',
    ],
  },
  smeGuidance: {
    title: 'Attendance checklist for SMEs',
    items: [
      {
        title: 'Confirm compulsory status',
        text: 'Verify in official PDF — not only the advert summary — before booking travel or agents.',
      },
      {
        title: 'Export to calendar',
        text: 'Add briefing and closing from tender detail pages; include travel buffer for site access.',
      },
      {
        title: 'Prepare registration pack',
        text: 'Company registration, ID, letter of authority if needed, PPE for construction sites.',
      },
      {
        title: 'Assign backup',
        text: 'If primary attendee cancels, trigger agent request early — same-day dispatch is not guaranteed.',
      },
    ],
  },
  processSteps: [
    {
      step: '1',
      title: 'Identify compulsory sessions',
      text: 'Use TenderBriefing filters and detail pages to list upcoming mandatory briefings.',
    },
    {
      step: '2',
      title: 'Choose attendance mode',
      text: 'Physical site, virtual link or authorised representative per tender rules.',
    },
    {
      step: '3',
      title: 'Block team calendars',
      text: 'Export events and assign accountable attendees with backup plans.',
    },
    {
      step: '4',
      title: 'Attend and document',
      text: 'Register on site or join virtually; capture notes or agent report.',
    },
    {
      step: '5',
      title: 'Proceed to submission',
      text: 'Only invest full bid effort once attendance compliance is secured.',
    },
  ],
  useCases: [
    {
      title: 'Teams briefing for ICT tender',
      scenario:
        'National department publishes compulsory Teams briefing at 10:00 with limited Q&A window.',
      outcome:
        'SME joins from office via link on TenderBriefing detail page; calendar reminder prevented clash with client call.',
    },
    {
      title: 'Hospital site briefing',
      scenario:
        'Security contractor must attend in person for access and SLA walkthrough.',
      outcome:
        'Owner attends with PPE; register proof stored for submission file.',
    },
    {
      title: 'Clashing municipal briefings',
      scenario:
        'Two compulsory sessions same day in different metros.',
      outcome:
        'Director attends priority bid; Youth Agent covers second for R249.',
    },
  ],
  provinceFocus: [],
  highlights: [
    'Briefing date and time on every tender detail page',
    'Venue addresses and virtual meeting links when published',
    'Calendar export for briefing and closing events',
    'Youth Agent attendance backup for R249 per session',
    'Official documents synced from eTenders',
  ],
  features: [
    {
      title: 'Calendar-ready data',
      text: 'Export briefing events to Google Calendar, Outlook or ICS from tender pages.',
    },
    {
      title: 'Venue clarity',
      text: 'See physical addresses and online links without digging through PDFs alone.',
    },
    {
      title: 'Compulsory flags',
      text: 'Mandatory sessions highlighted so attendance is never an afterthought.',
    },
    {
      title: 'Agent fallback',
      text: 'Request verified attendance when schedules or travel block in-person presence.',
    },
  ],
  faqs: [
    SME_FREE_FAQ,
    R249_FAQ,
    {
      question: 'Are virtual compulsory briefings supported on TenderBriefing?',
      answer:
        'Yes. When eTenders publishes an online meeting link, it appears on the tender detail page with date and time for calendar planning.',
    },
    COMPULSORY_DISQUALIFICATION_FAQ,
    AGENT_DELEGATION_FAQ,
    ETENDERS_FAQ,
    {
      question: 'Can I export briefing dates to my calendar?',
      answer:
        'Tender detail pages include calendar export options for briefing and closing events where dates are published.',
    },
    {
      question: 'What proof of attendance should I keep?',
      answer:
        'Signed registers, confirmation emails, virtual attendance logs where available, and Youth Agent reports from TenderBriefing.',
    },
    {
      question: 'Should I attend if the briefing is optional?',
      answer:
        'Optional briefings still provide valuable clarifications. Compulsory ones are compliance-critical — treat them differently in your workflow.',
    },
  ],
  ctaTitle: 'Never miss a compulsory briefing date again',
  ctaDescription:
    'Register free, export briefing calendars from live tenders, and book Youth Agent attendance for R249 when your team cannot be there.',
  ctaPrimaryLabel: 'Create free account',
  ctaSecondaryLabel: 'Browse briefing dates',
  relatedLinks: [
    { href: '/compulsory-tender-briefings', label: 'Compulsory briefing rules' },
    { href: '/tender-briefing-agent', label: 'Briefing agent service' },
    { href: '/how-it-works', label: 'Platform walkthrough' },
  ],
  tenderSectionTitle: 'Upcoming compulsory briefing sessions',
  tenderSectionIntro:
    'Live tenders with scheduled mandatory briefings — department, province, briefing datetime and closing date with links to full detail pages.',
}
