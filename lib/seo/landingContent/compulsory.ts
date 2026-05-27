import type { SeoLandingConfig } from '@/lib/seo/landingTypes'
import {
  AGENT_DELEGATION_FAQ,
  COMPULSORY_DISQUALIFICATION_FAQ,
  ETENDERS_FAQ,
  R249_FAQ,
  SME_FREE_FAQ,
} from './shared'

export const compulsoryBriefingsConfig: SeoLandingConfig = {
  slug: 'compulsory-tender-briefings',
  path: '/compulsory-tender-briefings',
  metaDescription:
    'Complete guide to compulsory tender briefings in South Africa. Track mandatory briefing dates, avoid disqualification, browse live eTenders opportunities and request Youth Agent attendance for R249 on TenderBriefing.',
  eyebrow: 'Compliance · Mandatory attendance',
  title: 'Compulsory Tender Briefings in South Africa',
  heroDescription:
    'Government tenders often require compulsory briefing attendance. TenderBriefing tracks mandatory sessions from official eTenders, shows dates, venues and documents, and connects SMEs to verified Youth Agents when they cannot attend in person.',
  heroPrimaryCta: 'Browse compulsory briefings free',
  heroSecondaryCta: 'View live tender list',
  intro:
    'A compulsory tender briefing is not optional paperwork — it is a compliance gate. Across South African public procurement, procuring entities use compulsory briefings and site meetings to explain scope, safety requirements, access conditions and submission rules. If your business misses the session, your bid may be rejected before evaluators even open your pricing schedule. TenderBriefing exists to solve that visibility problem for SMEs: we sync official National Treasury eTenders data, highlight tenders where briefing attendance is mandatory, and surface briefing date, time, venue and documents on every detail page so your team can plan early.',
  sections: [
    {
      heading: 'What makes a tender briefing compulsory?',
      paragraphs: [
        'On eTenders and in official tender PDFs, procuring entities state whether a briefing or site meeting is compulsory, recommended or not applicable. When marked compulsory, attendance is typically linked to bid validity — meaning non-attendance can disqualify your submission regardless of B-BBEE level, pricing or technical merit.',
        'Compulsory briefings appear across construction, facilities management, ICT, professional services, supply of goods and municipal contracts. The session may be physical (on-site at a hospital, school, depot or project location) or virtual via Microsoft Teams or Zoom when the entity publishes a meeting link.',
        'TenderBriefing reads the official tender record and enrichment signals to flag compulsory requirements clearly. On each tender detail page you will see whether attendance is mandatory, the scheduled date and time, venue or virtual link, and the verbatim scope description as published by the entity — not a shortened marketing summary.',
        'SMEs should treat compulsory briefings as part of the cost of bidding. Factor travel, safety equipment, ID checks and calendar blocking into your bid decision before you invest in pricing, method statements and compliance documents.',
      ],
    },
    {
      heading: 'Why SMEs miss compulsory briefings — and how to avoid it',
      paragraphs: [
        'Small businesses rarely miss compulsory briefings because they do not care. They miss them because discovery is fragmented. eTenders lists thousands of opportunities; briefing dates hide inside PDF attachments; and teams juggling operations, cash flow and multiple bids can easily overlook a Tuesday-morning site meeting in another province.',
        'Another common failure mode is assuming a colleague attended when no one actually registered at the venue, or sending a junior staff member without the authority or company documentation required for sign-in. Some tenders require pre-registration for briefings — if you only read the main advert and not the full document pack, you can be turned away at the gate.',
        'TenderBriefing reduces these risks by centring compulsory briefing intelligence: filtered lists of mandatory sessions, countdown context alongside closing dates, calendar export from tender detail pages, and optional Youth Agent attendance when your director cannot travel.',
        'Build an internal rule: no bid work starts until someone has confirmed briefing attendance or booked an agent. That single discipline prevents the most expensive mistake in public sector bidding — preparing a compliant proposal that never gets evaluated.',
      ],
    },
    {
      heading: 'The South African compulsory briefing process explained',
      paragraphs: [
        'Typical flow begins when a department, municipality or SOE publishes a tender on eTenders with a briefing date before the closing date. The entity uses the session to clarify scope, demonstrate site conditions, explain health and safety rules and answer bidder questions on record.',
        'Attendees usually sign a register. That register may be cross-checked against bidders at submission opening. For construction and demolition tenders, site meetings are especially strict because access, induction and PPE requirements affect both safety and pricing accuracy.',
        'After the briefing, clarifications may be issued as addenda on eTenders. TenderBriefing keeps the original documents and key dates visible so you can compare what was said in the session with what was formally published.',
        'If you cannot attend, check whether the tender allows a authorised representative. Where it does, TenderBriefing Youth Agents can attend for a fixed R249, capture structured notes and help your team stay eligible to submit.',
      ],
    },
    {
      heading: 'How TenderBriefing helps suppliers stay compliant',
      paragraphs: [
        'TenderBriefing is a South African procurement support platform built around compulsory briefings — not generic tender scraping. We prioritise the dates and compliance signals SMEs need before committing bid resources.',
        'Registered SMEs browse live opportunities free. Each listing links to a detail page with official scope text, department, province, briefing and closing dates, downloadable documents and contact details when published on eTenders.',
        'When attendance is mandatory and your team is unavailable, request a verified Youth Agent through the platform. You pay R249 only for that attendance request — not for discovery, not for registration, not for viewing documents.',
        'Briefing reports returned by agents capture instructions, risks, access constraints and submission reminders discussed in the session — giving remote owners and bid administrators the operational context they would have gained in person.',
      ],
    },
    {
      heading: 'Practical checklist before every compulsory briefing',
      paragraphs: [
        'Confirm in the official PDF whether attendance is compulsory and whether pre-registration is required. Add the briefing and closing dates to your calendar immediately — closing without briefing attendance is wasted effort.',
        'Assign one accountable person for attendance. If using an agent, request early; popular provincial briefings have limited travel windows.',
        'Prepare company identification, proof of registration on eTenders if required, PPE for site visits and questions about ambiguities in scope. Good questions protect your bid from assumptions that become pricing errors.',
        'After the session, update your compliance file with register proof, agent report or internal notes and watch for addenda until closing.',
      ],
    },
  ],
  authority: {
    heading: 'Why compulsory briefings matter for South African procurement',
    paragraphs: [
      'Public procurement in South Africa is governed by fairness, transparency and value-for-money principles under the Preferential Procurement Policy Framework Act and related treasury regulations. Briefings give procuring entities a controlled forum to ensure all bidders receive the same information — especially for complex or site-dependent work.',
      'For SMEs entering government supply chains, compulsory briefings are often the first real interaction with the entity’s project team. Attendance signals seriousness, reduces frivolous bids and helps smaller firms price accurately when they see actual site conditions.',
      'TenderBriefing does not replace official channels. We make them usable for businesses without dedicated tender departments — surfacing mandatory sessions early, linking to real tender detail pages and offering affordable attendance support when geography or capacity would otherwise force a pass.',
    ],
  },
  smeGuidance: {
    title: 'SME guidance for compulsory briefing compliance',
    items: [
      {
        title: 'Verify before you bid',
        text: 'Open the tender documents and confirm the briefing is compulsory — not merely recommended. TenderBriefing flags mandatory sessions, but the official PDF remains the legal source.',
      },
      {
        title: 'Block calendars early',
        text: 'Briefing dates often fall on weekdays during business hours. Block time for travel across Gauteng, KwaZulu-Natal, Western Cape and other provinces as soon as you shortlist the opportunity.',
      },
      {
        title: 'Use agents strategically',
        text: 'When a high-value tender clashes with operations, a Youth Agent at R249 is often cheaper than disqualification or a rushed overnight trip for a director.',
      },
      {
        title: 'Document everything',
        text: 'Keep register slips, photos where permitted, agent briefing reports and internal notes. They support compliance if submission opening queries arise.',
      },
    ],
  },
  processSteps: [
    {
      step: '1',
      title: 'Discover on TenderBriefing',
      text: 'Browse live compulsory briefings synced from eTenders. Filter by province, department or closing window.',
    },
    {
      step: '2',
      title: 'Read official documents',
      text: 'Download PDFs from the tender detail page. Confirm attendance rules, pre-registration and representative policies.',
    },
    {
      step: '3',
      title: 'Plan attendance',
      text: 'Attend in person, join virtually if offered, or request a verified Youth Agent for R249 when you cannot be there.',
    },
    {
      step: '4',
      title: 'Capture session intelligence',
      text: 'Record scope clarifications, risks and addenda references. Agents return structured briefing notes for remote teams.',
    },
    {
      step: '5',
      title: 'Submit through official channels',
      text: 'Complete your proposal and submit via eTenders or the method specified — with confidence your briefing compliance is covered.',
    },
  ],
  useCases: [
    {
      title: 'Construction SME in Gauteng',
      scenario:
        'A building contractor spots a school renovation tender in Pretoria with a compulsory site meeting on short notice while the owner is on another project.',
      outcome:
        'They request a Youth Agent via TenderBriefing for R249, receive a site report with access and safety notes, and submit without disqualification.',
    },
    {
      title: 'Security services provider',
      scenario:
        'A KwaZulu-Natal firm wants to bid on a hospital guarding contract but the compulsory briefing is during a staffing crisis.',
      outcome:
        'An agent attends, captures uniform and SLA clarifications, and the SME adjusts pricing before closing.',
    },
    {
      title: 'First-time government supplier',
      scenario:
        'A Western Cape cleaning SME is new to eTenders and almost missed a compulsory Teams briefing hidden in an attachment.',
      outcome:
        'TenderBriefing’s detail page surfaced date, time and link prominently; the owner attended virtually and registered on time.',
    },
  ],
  provinceFocus: [],
  highlights: [
    'Live compulsory briefing opportunities from official eTenders sync',
    'Briefing date, time, venue and virtual links on every detail page',
    'Official scope text and downloadable tender documents',
    'Youth Agent attendance for R249 when you cannot be there in person',
    'Free SME registration — pay only for optional agent support',
  ],
  features: [
    {
      title: 'Compulsory-only focus',
      text: 'Cut through noise by prioritising tenders where mandatory briefing attendance affects bid validity.',
    },
    {
      title: 'Compliance countdown',
      text: 'See briefing and closing dates together so your team sequences site visits before document preparation.',
    },
    {
      title: 'Agent dispatch',
      text: 'Verified Youth Agents represent your business at official sessions when travel or operations block attendance.',
    },
    {
      title: 'Official data integrity',
      text: 'Descriptions and documents reflect eTenders source material — the same text evaluators expect bidders to follow.',
    },
  ],
  faqs: [
    SME_FREE_FAQ,
    R249_FAQ,
    COMPULSORY_DISQUALIFICATION_FAQ,
    AGENT_DELEGATION_FAQ,
    ETENDERS_FAQ,
    {
      question: 'How do I know if a briefing is compulsory on TenderBriefing?',
      answer:
        'Compulsory tenders are flagged on listing and detail pages with briefing date, time and venue. Always cross-check the official PDF because procuring entities may update requirements via addenda.',
    },
    {
      question: 'Are virtual compulsory briefings supported?',
      answer:
        'When eTenders publishes a Teams, Zoom or other meeting link, TenderBriefing displays it alongside the scheduled date and time so you can join remotely if the entity allows.',
    },
    {
      question: 'What should I bring to a physical site briefing?',
      answer:
        'Typically company identification, proof of eTenders registration if required, appropriate PPE for construction or industrial sites, and written questions. Requirements vary — read the tender documents carefully.',
    },
    {
      question: 'Can I browse compulsory briefings without registering?',
      answer:
        'Public tender listings and detail pages are available for discovery. Creating a free SME account unlocks tracking, RFQ inbox features and agent requests when you are ready to bid.',
    },
  ],
  ctaTitle: 'Stop losing bids to missed compulsory briefings',
  ctaDescription:
    'Register free, browse live mandatory briefing opportunities across South Africa, and request a Youth Agent for R249 only when you need attendance support.',
  ctaPrimaryLabel: 'Create free SME account',
  ctaSecondaryLabel: 'Explore all tenders',
  relatedLinks: [
    { href: '/tender-briefing-attendance', label: 'Briefing attendance planning' },
    { href: '/tender-briefing-agent', label: 'Request a briefing agent' },
    { href: '/tenders/gauteng', label: 'Gauteng compulsory briefings' },
    { href: '/resources/how-compulsory-tender-briefings-work', label: 'How compulsory briefings work' },
  ],
  tenderSectionTitle: 'Latest compulsory briefing opportunities',
  tenderSectionIntro:
    'Live tenders from official eTenders where briefing attendance is mandatory. Each row links to the full detail page with documents, department, province and closing date.',
}
