import type { SeoLandingConfig } from '@/lib/seo/landingTypes'
import {
  AGENT_DELEGATION_FAQ,
  ETENDERS_FAQ,
  R249_FAQ,
  SME_FREE_FAQ,
} from './shared'

export const briefingAgentConfig: SeoLandingConfig = {
  slug: 'tender-briefing-agent',
  path: '/tender-briefing-agent',
  metaDescription:
    'Hire a verified Youth Agent to attend compulsory tender briefings for R249. Free tender discovery for SMEs — fixed fee per briefing, structured reports and official eTenders data on TenderBriefing.',
  eyebrow: 'Youth Agents · Fixed R249',
  title: 'Tender Briefing Agent Service for SMEs',
  heroDescription:
    'When you cannot attend a compulsory briefing in person, TenderBriefing dispatches verified Youth Agents to represent your business at the official session — one transparent R249 fee per request, with structured notes returned afterward.',
  heroPrimaryCta: 'Request a briefing agent',
  heroSecondaryCta: 'Find compulsory briefings',
  intro:
    'Compulsory tender briefings create a scheduling conflict for almost every growing SME: the session is mid-week, out of town, or overlaps with client delivery — but missing it disqualifies the bid. Hiring a full-time tender administrator is expensive; skipping the briefing is worse. TenderBriefing’s briefing agent service bridges that gap with verified Youth Agents who attend official government sessions on your behalf for a fixed R249 per compulsory briefing, while tender discovery on the platform remains completely free.',
  sections: [
    {
      heading: 'What a TenderBriefing agent does at the session',
      paragraphs: [
        'A Youth Agent is not a generic courier. Agents arrive prepared with your company details, register on the attendance list where required, listen to scope presentations, capture clarifications and note risks that affect pricing or method statements.',
        'After the briefing, agents return structured reporting through TenderBriefing — key instructions, venue or access conditions, safety requirements, submission reminders and any verbal clarifications that may later appear as addenda.',
        'Agents follow the official rules of the procuring entity. If a tender requires the director personally or prohibits delegation, TenderBriefing surfaces that in the tender documents so you do not request unsupported attendance.',
      ],
    },
    {
      heading: 'When to use an agent versus attending yourself',
      paragraphs: [
        'Attend personally when relationship building, complex technical Q&A or high-value strategic bids justify director time on site. Use an agent when travel cost exceeds sensible bid spend, when you are testing a new province, or when two compulsory briefings clash on the same morning.',
        'Agents are especially valuable for site briefings at hospitals, schools, depots and industrial plants where seeing conditions matters but flying a senior estimator from another city does not.',
        'The R249 fee is per briefing request — not a subscription — so you deploy agents selectively on opportunities that pass your initial compliance and capacity review.',
      ],
    },
    {
      heading: 'How the agent request flow works',
      paragraphs: [
        'Register free as an SME, locate a compulsory briefing on TenderBriefing and open the tender detail page. Review official documents, briefing date, time and venue or virtual link.',
        'When you confirm you need attendance support, submit an agent request through the platform. Payment of R249 applies to that confirmed request — not to browsing or document download.',
        'TenderBriefing matches available verified Youth Agents in the region, coordinates attendance and delivers status updates. After the session you receive briefing intelligence to feed your bid team.',
      ],
    },
    {
      heading: 'Trust, verification and quality assurance',
      paragraphs: [
        'Youth Agents complete onboarding and verification before receiving assignments. SLAs around attendance proof and reporting protect SMEs who rely on agents for compliance eligibility.',
        'TenderBriefing uses official eTenders data to align dispatch with real published sessions — reducing fraud risk from fake briefings or outdated dates.',
        'SMEs retain responsibility for final bid content; agents provide attendance compliance and session intelligence, not pricing or technical authorship.',
      ],
    },
    {
      heading: 'Pricing transparency: free discovery, paid attendance',
      paragraphs: [
        'TenderBriefing never charges SMEs to search tenders, view compulsory flags or read official scope text. The R249 fee is explicitly tied to optional agent attendance — a model designed for owner-managed businesses watching cash flow.',
        'Compare R249 against fuel, accommodation, lost billable hours and disqualification risk. For many provincial briefings, agent attendance is the rational compliance choice.',
        'See full pricing context on /pricing and process details on /how-it-works.',
      ],
    },
  ],
  authority: {
    heading: 'How TenderBriefing helps suppliers who cannot be everywhere',
    paragraphs: [
      'Large incumbents maintain tender teams on the road weekly. SMEs compete with the same compulsory briefing rules but fraction of the overhead. TenderBriefing democratises compliance by productising attendance through a youth workforce — creating jobs while solving a real disqualification problem.',
      'The platform is South African, eTenders-aligned and SME-first. Agents extend your reach into Gauteng, Western Cape, KZN and other provinces without opening branch offices.',
    ],
  },
  smeGuidance: {
    title: 'Getting the most from briefing agents',
    items: [
      {
        title: 'Request early',
        text: 'Popular briefings have limited agent capacity. Submit requests as soon as you shortlist the tender.',
      },
      {
        title: 'Brief your agent',
        text: 'Share company registration details, contact person and specific questions you need answered from the session.',
      },
      {
        title: 'Read the report fast',
        text: 'Agent notes may reveal scope changes that affect your go/no-go decision before you invest in pricing.',
      },
      {
        title: 'Confirm delegation rules',
        text: 'Always verify the tender allows representative attendance — your agent request should follow official PDF rules.',
      },
    ],
  },
  processSteps: [
    {
      step: '1',
      title: 'Find a compulsory briefing',
      text: 'Browse live tenders flagged mandatory on TenderBriefing.',
    },
    {
      step: '2',
      title: 'Validate delegation',
      text: 'Read official documents to confirm representative attendance is permitted.',
    },
    {
      step: '3',
      title: 'Submit agent request',
      text: 'Confirm R249 attendance support through the platform.',
    },
    {
      step: '4',
      title: 'Agent attends officially',
      text: 'Youth Agent registers, participates and captures session intelligence.',
    },
    {
      step: '5',
      title: 'Bid with compliance covered',
      text: 'Use the briefing report to finalise your submission before closing.',
    },
  ],
  useCases: [
    {
      title: 'Dual briefing clash',
      scenario:
        'A director faces compulsory briefings in Johannesburg and Rustenburg on the same morning.',
      outcome:
        'They attend one personally and dispatch an agent to the other for R249 — both bids stay eligible.',
    },
    {
      title: 'Out-of-province exploratory bid',
      scenario:
        'A Cape Town supplier trials a Free State tender without opening a local office.',
      outcome:
        'Agent attendance provides site notes; the company decides go/no-go with real information.',
    },
    {
      title: 'Owner-operator schedule lock',
      scenario:
        'A plumbing SME owner cannot leave an active client job for a two-hour municipal briefing.',
      outcome:
        'Youth Agent covers attendance; owner reviews report that evening and prices accurately.',
    },
  ],
  provinceFocus: [],
  highlights: [
    'Verified Youth Agents for official session attendance',
    'Fixed R249 per briefing request — no subscription',
    'Free tender discovery and document access for SMEs',
    'Structured briefing reports after each session',
    'WhatsApp and in-app status updates during dispatch',
  ],
  features: [
    {
      title: 'Simple request UX',
      text: 'Move from tender detail to agent request in minutes when compulsory attendance blocks you.',
    },
    {
      title: 'Fixed pricing',
      text: 'R249 per attendance — predictable compliance cost for cash-conscious SMEs.',
    },
    {
      title: 'Session documentation',
      text: 'Reports capture instructions and risks discussed live at the briefing.',
    },
    {
      title: 'Regional matching',
      text: 'Agents assigned based on province and availability near the published venue.',
    },
  ],
  faqs: [
    SME_FREE_FAQ,
    R249_FAQ,
    {
      question: 'Who are Youth Agents on TenderBriefing?',
      answer:
        'Verified representatives who attend compulsory briefings on behalf of SMEs and return structured session notes. They complete platform onboarding before receiving assignments.',
    },
    {
      question: 'Is the R249 fee per tender or per month?',
      answer: 'Per briefing attendance request — not a monthly subscription.',
    },
    AGENT_DELEGATION_FAQ,
    ETENDERS_FAQ,
    {
      question: 'What if the tender requires the director personally?',
      answer:
        'Some tenders mandate specific roles. Always read the official documents — TenderBriefing highlights compulsory briefings but cannot override entity-specific attendance rules.',
    },
    {
      question: 'How quickly should I request an agent?',
      answer:
        'As soon as you decide to bid. Briefings often fall mid-week with limited travel windows for agents.',
    },
    {
      question: 'Do agents download tender documents for me?',
      answer:
        'Documents are already on TenderBriefing from eTenders sync. Agents focus on live session attendance and reporting.',
    },
  ],
  ctaTitle: 'Book a tender briefing agent when travel blocks you',
  ctaDescription:
    'Browse compulsory briefings free. Pay R249 only when you confirm Youth Agent attendance at an official session.',
  ctaPrimaryLabel: 'Sign up and request agent',
  ctaSecondaryLabel: 'View compulsory tenders',
  relatedLinks: [
    { href: '/youth-agent-tender-support', label: 'Youth agent programme' },
    { href: '/tender-briefing-attendance', label: 'Attendance planning' },
    { href: '/pricing', label: 'Full pricing breakdown' },
  ],
  tenderSectionTitle: 'Compulsory briefings open for agent requests',
  tenderSectionIntro:
    'Current mandatory briefing opportunities where SMEs frequently request Youth Agent attendance — each links to documents, dates and the agent request flow.',
}
