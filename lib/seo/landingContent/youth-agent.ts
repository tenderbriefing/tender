import type { SeoLandingConfig } from '@/lib/seo/landingTypes'
import {
  ETENDERS_FAQ,
  R249_FAQ,
  SME_FREE_FAQ,
} from './shared'

export const youthAgentConfig: SeoLandingConfig = {
  slug: 'youth-agent-tender-support',
  path: '/youth-agent-tender-support',
  metaDescription:
    'Youth Agent tender support programme in South Africa. Verified agents attend compulsory briefings for SMEs; suppliers browse free and pay R249 only when requesting attendance on TenderBriefing.',
  eyebrow: 'Youth Agents · Earn & learn',
  title: 'Youth Agent Tender Support Programme',
  heroDescription:
    'TenderBriefing connects verified Youth Agents with SMEs who need compulsory briefing attendance. Suppliers discover tenders free; agents earn by representing businesses at official government sessions nationwide.',
  heroPrimaryCta: 'Join as Youth Agent',
  heroSecondaryCta: 'I am an SME — browse free',
  intro:
    'South Africa’s unemployment challenge and SME procurement compliance gap share a practical bridge: Youth Agents on TenderBriefing. SMEs browsing government opportunities often cannot attend every compulsory briefing — travel, client work and multi-province bids get in the way. Verified youth representatives attend official sessions on their behalf for a fixed R249 fee per request, returning structured notes that keep bids eligible. SMEs pay nothing to discover tenders; agents build work experience in the real procurement economy. This page explains both sides of the Youth Agent tender support model and how it fits into official eTenders processes.',
  sections: [
    {
      heading: 'The dual mission: SME compliance and youth opportunity',
      paragraphs: [
        'Government wants capable SMEs in supply chains. SMEs want fair access without disqualification on attendance technicalities. Young job seekers want credible work experience beyond generic internships.',
        'Youth Agent tender support aligns those interests: when an SME confirms R249 attendance support, a verified agent travels to or joins the compulsory briefing, registers correctly and documents session intelligence.',
        'The model is transparent — no hidden subscription for SMEs, no pay-to-list for agents beyond platform onboarding requirements outlined in the agent signup flow.',
      ],
    },
    {
      heading: 'For SMEs: when Youth Agents make business sense',
      paragraphs: [
        'Use agents when briefing travel destroys bid margin, when leadership is double-booked, or when exploring new provinces before committing branch costs.',
        'R249 is predictable compared to flights, hotels and lost delivery days — especially for RFQs and mid-value tenders where full director travel is hard to justify.',
        'Agent reports translate session content for owners who price bids at night after client work — closing the information gap without physical presence.',
      ],
    },
    {
      heading: 'For Youth Agents: verification, dispatch and reporting',
      paragraphs: [
        'Agents register through a dedicated youth-agent onboarding path separate from SME signup. Verification confirms identity, reliability and understanding of procurement etiquette before assignments.',
        'Dispatch matches agents to published compulsory briefings using official eTenders-derived data on TenderBriefing — real venues, dates and departments.',
        'After attendance, agents submit structured reporting so SMEs can prove compliance and adjust bids. Quality standards protect the network’s reputation with suppliers and procuring entities.',
      ],
    },
    {
      heading: 'How Youth Agent support differs from informal proxies',
      paragraphs: [
        'Sending a friend to a briefing without registration or company authority risks compliance failure. TenderBriefing agents operate within documented representative rules and platform SLAs.',
        'Official scope and documents remain on tender detail pages — agents focus on attendance and capture, not bid writing or pricing decisions.',
        'SMEs retain accountability for submissions; agents solve the physical presence problem at official sessions.',
      ],
    },
    {
      heading: 'Nationwide footprint and provincial matching',
      paragraphs: [
        'Compulsory briefings occur in every province. Agent networks grow regionally so Gauteng, KZN, Western Cape and other hubs have coverage density.',
        'SMEs link to provincial tender pages — Gauteng, Western Cape, KwaZulu-Natal — to combine regional discovery with agent availability.',
        'Live stats on landing pages show departments and provinces actively publishing — indicating where agent demand concentrates.',
      ],
    },
  ],
  authority: {
    heading: 'Shared value in South African public procurement',
    paragraphs: [
      'TenderBriefing is not only software — it is infrastructure for inclusive procurement participation. Youth Agent tender support reduces disqualification rates for SMEs while creating paid micro-assignments tied to real government sessions.',
      'Procuring entities still control tender rules; the platform respects official documents and attendance registers. SMEs gain compliance capacity; youth gain CV-worthy experience in SCM environments.',
    ],
  },
  smeGuidance: {
    title: 'SME tips for working with Youth Agents',
    items: [
      {
        title: 'Request only when rules allow',
        text: 'Confirm representative attendance is permitted in the tender PDF before booking an agent.',
      },
      {
        title: 'Provide context',
        text: 'Share company name as registered, contact details and questions agents should raise at the briefing.',
      },
      {
        title: 'Review reports promptly',
        text: 'Agent notes may change go/no-go decisions — read them before committing bid resources.',
      },
      {
        title: 'Combine with resources',
        text: 'Use /resources articles on compulsory briefings to train internal staff alongside agent support.',
      },
    ],
  },
  processSteps: [
    {
      step: '1',
      title: 'SME finds compulsory briefing',
      text: 'Free discovery on TenderBriefing with official dates and documents.',
    },
    {
      step: '2',
      title: 'Agent request confirmed',
      text: 'SME pays R249 for attendance support on that specific briefing.',
    },
    {
      step: '3',
      title: 'Youth Agent dispatched',
      text: 'Verified agent attends official session and registers as representative.',
    },
    {
      step: '4',
      title: 'Report delivered',
      text: 'Structured briefing intelligence returned to the SME bid team.',
    },
    {
      step: '5',
      title: 'SME submits bid',
      text: 'Compliance intact; agent assignment complete.',
    },
  ],
  useCases: [
    {
      title: 'Youth graduate in Pretoria',
      scenario:
        'Recent graduate completes agent verification and accepts Gauteng health department briefing assignments.',
      outcome:
        'Earns per-session fees while building procurement network knowledge.',
    },
    {
      title: 'Rural SME owner',
      scenario:
        'Northern Cape supplier uses coastal agent for Western Cape compulsory site briefing.',
      outcome:
        'Stays eligible without interstate travel cost on exploratory bid.',
    },
    {
      title: 'Agent portfolio career',
      scenario:
        'Agent documents 40+ briefing attendances across municipalities over a year.',
      outcome:
        'CV demonstrates SCM exposure attractive to corporate supply chain employers.',
    },
  ],
  provinceFocus: [],
  highlights: [
    'Verified Youth Agent network for compulsory briefings',
    'SMEs browse tenders free — R249 only per agent request',
    'Structured post-briefing reports for bid teams',
    'Separate onboarding for youth agents and SMEs',
    'Official eTenders data drives real assignments',
  ],
  features: [
    {
      title: 'For SMEs',
      text: 'Free registration, live tenders, optional R249 attendance when you cannot be on site.',
    },
    {
      title: 'For Youth Agents',
      text: 'Apply, verify and accept briefing assignments in your province.',
    },
    {
      title: 'Quality assurance',
      text: 'Attendance proof and reporting SLAs maintain trust across the marketplace.',
    },
    {
      title: 'Economic inclusion',
      text: 'Links youth employment to SME procurement compliance outcomes.',
    },
  ],
  faqs: [
    SME_FREE_FAQ,
    R249_FAQ,
    {
      question: 'How do I become a Youth Agent on TenderBriefing?',
      answer:
        'Register through the youth agent signup flow, complete onboarding and verification, then accept assignments via the agent dashboard when SMEs request attendance in your area.',
    },
    {
      question: 'Do agents pay to join the platform?',
      answer:
        'Youth Agents follow a separate onboarding process. SMEs never pay to browse tenders — only R249 when requesting agent attendance.',
    },
    ETENDERS_FAQ,
    {
      question: 'How much do Youth Agents earn per briefing?',
      answer:
        'Compensation follows TenderBriefing agent programme terms tied to completed attendance and reporting — see agent onboarding for current structure.',
    },
    {
      question: 'Can one agent represent multiple SMEs at the same briefing?',
      answer:
        'Procurement rules and entity policies vary. Agents follow official registration requirements; SMEs should not assume shared attendance unless permitted.',
    },
    {
      question: 'What skills do Youth Agents need?',
      answer:
        'Reliability, punctuality, professional conduct at government sessions, note-taking and basic understanding of tender briefing etiquette.',
    },
    {
      question: 'Is agent attendance legal for all tenders?',
      answer:
        'Only where tender documents allow authorised representatives. SMEs must verify delegation rules; TenderBriefing surfaces documents to support that review.',
    },
  ],
  ctaTitle: 'Join the Youth Agent tender support network',
  ctaDescription:
    'SMEs register free to browse briefings. Youth Agents apply to earn by attending compulsory sessions on behalf of suppliers across South Africa.',
  ctaPrimaryLabel: 'Apply as Youth Agent',
  ctaSecondaryLabel: 'Browse tenders as SME',
  relatedLinks: [
    { href: '/auth/signup?type=youth-agent', label: 'Youth agent signup' },
    { href: '/youth-agents', label: 'About youth agents' },
    { href: '/tender-briefing-agent', label: 'Agent service for SMEs' },
  ],
  tenderSectionTitle: 'Briefings Youth Agents are supporting now',
  tenderSectionIntro:
    'Live compulsory briefing opportunities where SMEs frequently book Youth Agent attendance — real departments, provinces and closing dates from eTenders.',
}
