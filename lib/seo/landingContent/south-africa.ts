import type { SeoLandingConfig } from '@/lib/seo/landingTypes'
import {
  AGENT_DELEGATION_FAQ,
  COMPULSORY_DISQUALIFICATION_FAQ,
  ETENDERS_FAQ,
  R249_FAQ,
  SME_FREE_FAQ,
} from './shared'

export const southAfricaConfig: SeoLandingConfig = {
  slug: 'tender-briefings-south-africa',
  path: '/tender-briefings-south-africa',
  metaDescription:
    'Nationwide tender briefing discovery for South African SMEs. Track compulsory government briefings in all nine provinces, sync official eTenders data and request Youth Agent attendance for R249 on TenderBriefing.',
  eyebrow: 'South Africa · All provinces',
  title: 'Tender Briefings Across South Africa',
  heroDescription:
    'From Gauteng departments to Western Cape municipalities and KwaZulu-Natal SOEs — TenderBriefing helps South African SMEs discover compulsory tender briefings nationwide with official dates, documents and optional agent support.',
  heroPrimaryCta: 'Start free nationwide discovery',
  heroSecondaryCta: 'See tenders by province',
  intro:
    'South Africa’s public procurement landscape spans national departments, provincial administrations, metros, district municipalities and state-owned entities — each publishing on National Treasury eTenders with different briefing cultures, document formats and compliance expectations. For SMEs without dedicated bid offices, the challenge is not finding one tender; it is maintaining visibility across nine provinces while running day-to-day operations. TenderBriefing is built as a South African procurement support platform that organises official eTenders data around compulsory briefings: the sessions where missing a single meeting can end a bid before evaluation begins.',
  sections: [
    {
      heading: 'Public procurement geography: national, provincial and local',
      paragraphs: [
        'National departments such as Public Works, Health and Home Affairs publish high-value tenders that may require briefings in Pretoria, Cape Town or regional hubs. Provincial treasuries and line departments add another layer — Eastern Cape roads, Free State agriculture, Limpopo education and Mpumalanga infrastructure each carry local briefing venues and travel requirements.',
        'Metros including Johannesburg, Tshwane, eThekwini and Cape Town run their own SCM processes with frequent compulsory site meetings for facilities, waste, security and ICT contracts. Rural municipalities may combine briefings with site visits where GPS coordinates matter for pricing transport and labour.',
        'TenderBriefing normalises this diversity into a single SME-friendly view: province tags, department names, official scope descriptions, briefing schedules and closing dates — all linked to live tender detail pages you can share with estimators, safety officers and directors.',
      ],
    },
    {
      heading: 'Compulsory briefings as a nationwide compliance pattern',
      paragraphs: [
        'Regardless of province, compulsory briefings serve the same policy purpose: equal information to all bidders. Entities use them for complex scopes — hospital upgrades, school security upgrades, network rollouts, demolition work — where assumptions create unequal bids or safety incidents.',
        'SMEs operating in multiple provinces must track briefing calendars that do not align with closing dates. A briefing in Bloemfontein on Wednesday and a closing in Johannesburg on Friday is workable; missing the Wednesday session is not.',
        'TenderBriefing highlights compulsory sessions early and supports calendar exports so regional teams coordinate without WhatsApp chains and screenshot PDFs. When leadership cannot travel, Youth Agents provide per-briefing attendance at R249 — cheaper than multi-province disqualification.',
      ],
    },
    {
      heading: 'How official eTenders data reaches TenderBriefing',
      paragraphs: [
        'TenderBriefing syncs from official eTenders publication feeds. We preserve tender numbers, descriptions, departments, dates and document links so your team works from the same source material evaluators reference.',
        'Enrichment layers identify briefing language in documents, compulsory flags, venues, virtual meeting links and provincial placement — reducing the time SMEs spend opening every PDF on the portal.',
        'We do not replace eTenders submission workflows. TenderBriefing is the intelligence and attendance layer: discover, comply with briefings, then submit through treasury-mandated channels.',
      ],
    },
    {
      heading: 'Benefits of TenderBriefing for South African SMEs',
      paragraphs: [
        'Free discovery lowers the barrier for emerging contractors, suppliers and professional firms entering government markets. You register once, browse live opportunities and only pay R249 when requesting optional Youth Agent attendance.',
        'Structured tender detail pages reduce misinterpretation — official scope text is shown verbatim, briefing times include hours where published, and documents are collected in one place.',
        'Internal linking across provinces and sectors helps you explore adjacent opportunities: Gauteng construction today, Western Cape cleaning tomorrow — without losing compliance context.',
        'Resources and guides on TenderBriefing explain PFMA, MFMA and briefing etiquette in plain language so owner-managed businesses compete with larger incumbents on information parity.',
      ],
    },
    {
      heading: 'Regional strategy for multi-province bidders',
      paragraphs: [
        'Assign province owners inside your company — one lead for Gauteng and Limpopo, another for KZN and Eastern Cape — each monitoring TenderBriefing lists and compulsory dates weekly.',
        'Combine agent attendance with selective in-person briefings for flagship contracts where relationship and site feel matter.',
        'Use province filter chips and programmatic pages such as Gauteng, Western Cape and KwaZulu-Natal to deep-link bookmarkable views for your team.',
        'Track closing-within-seven-days metrics on the live stats block to prioritise urgent compliance work across regions.',
      ],
    },
  ],
  authority: {
    heading: 'South African procurement support built for SMEs',
    paragraphs: [
      'TenderBriefing addresses a gap in the market: enterprise tender platforms priced for large compliance teams versus raw eTenders search with no briefing-centric workflow. Our focus is compulsory tender briefings because that is where SMEs lose disproportionately — not on pricing, but on attendance.',
      'Youth Agent attendance creates shared value: SMEs stay eligible; young people earn experience in the procurement economy; entities still see registered attendance at official sessions.',
      'Whether you are a first-time supplier in the Northern Cape or an established Gauteng contractor expanding coastward, TenderBriefing gives you the same briefing intelligence national firms build in-house.',
    ],
  },
  smeGuidance: {
    title: 'Nationwide SME playbook',
    items: [
      {
        title: 'Start with province filters',
        text: 'Focus discovery on provinces where you are registered, have staff or can reach briefings within travel budget.',
      },
      {
        title: 'Watch national + local',
        text: 'High-value national tenders may brief in one city while local metros publish weekly compulsory site meetings nearby.',
      },
      {
        title: 'Agents for distance',
        text: 'Use R249 agent attendance when briefing travel exceeds sensible bid spend — especially for exploratory opportunities.',
      },
      {
        title: 'Share detail links',
        text: 'Send tender detail URLs to technical and finance colleagues so everyone works from the same official scope and dates.',
      },
    ],
  },
  processSteps: [
    {
      step: '1',
      title: 'Register free as an SME',
      text: 'Create your account and set notification preferences for provinces and sectors you serve.',
    },
    {
      step: '2',
      title: 'Browse by province or sector',
      text: 'Use /tenders, regional pages and live stats to shortlist compulsory briefing opportunities.',
    },
    {
      step: '3',
      title: 'Review official documents',
      text: 'Download PDFs, confirm briefing rules and assess bid feasibility with your team.',
    },
    {
      step: '4',
      title: 'Attend or delegate',
      text: 'Travel to the briefing, join virtually if offered, or request a Youth Agent for fixed R249 support.',
    },
    {
      step: '5',
      title: 'Submit via official channels',
      text: 'Complete proposals on eTenders or entity-specific portals before closing — compliant and informed.',
    },
  ],
  useCases: [
    {
      title: 'Eastern Cape services firm',
      scenario:
        'A facilities SME wants Port Elizabeth and Mthatha opportunities but directorship is split between sites.',
      outcome:
        'Province filters and agent attendance keep them eligible on simultaneous compulsory briefings.',
    },
    {
      title: 'National ICT reseller',
      scenario:
        'An ICT supplier tracks departmental datacentre RFQs with virtual briefings across provinces.',
      outcome:
        'TenderBriefing consolidates Teams links and closing dates; the bid team joins remotely from Johannesburg.',
    },
    {
      title: 'Limpopo construction JV',
      scenario:
        'A joint venture needs consistent briefing intelligence for road maintenance tenders.',
      outcome:
        'Shared tender detail links and agent reports align JV partners on scope before pricing.',
    },
  ],
  provinceFocus: [],
  highlights: [
    'All nine provinces represented in live eTenders sync',
    'National, provincial and municipal opportunities in one view',
    'Compulsory briefing dates, times and venues highlighted',
    'Free SME discovery with optional R249 agent attendance',
    'Links to regional tender pages and procurement resources',
  ],
  features: [
    {
      title: 'Province-aware discovery',
      text: 'Filter and chip-link into Gauteng, Western Cape, KZN and other regional listing pages.',
    },
    {
      title: 'Live stats dashboard',
      text: 'See compulsory briefing counts, departments publishing and provinces covered — updated from sync.',
    },
    {
      title: 'Document centralisation',
      text: 'Official PDFs and attachments accessible from each tender detail page.',
    },
    {
      title: 'Agent network',
      text: 'Youth Agents attend on your behalf when nationwide travel is impractical.',
    },
  ],
  faqs: [
    SME_FREE_FAQ,
    R249_FAQ,
    {
      question: 'What is a tender briefing in South Africa?',
      answer:
        'A tender briefing is a meeting — physical or virtual — where a procuring entity explains a government opportunity. When compulsory, non-attendance can disqualify bidders.',
    },
    ETENDERS_FAQ,
    COMPULSORY_DISQUALIFICATION_FAQ,
    AGENT_DELEGATION_FAQ,
    {
      question: 'Which provinces does TenderBriefing cover?',
      answer:
        'All nine provinces: Eastern Cape, Free State, Gauteng, KwaZulu-Natal, Limpopo, Mpumalanga, Northern Cape, North West and Western Cape — based on official tender location data.',
    },
    {
      question: 'Can I track tenders outside my home province?',
      answer:
        'Yes. Many SMEs bid nationally. Use province filters and agent attendance when travel is required for compulsory briefings.',
    },
    {
      question: 'Where do I submit my bid after using TenderBriefing?',
      answer:
        'Submit through eTenders or the submission method specified in the official tender documents — TenderBriefing supports discovery and briefing compliance, not submission replacement.',
    },
  ],
  ctaTitle: 'Discover tender briefings in every province',
  ctaDescription:
    'Join South African SMEs using TenderBriefing for free compulsory briefing discovery — pay R249 only when you need Youth Agent attendance.',
  ctaPrimaryLabel: 'Register free today',
  ctaSecondaryLabel: 'Browse national tenders',
  relatedLinks: [
    { href: '/compulsory-tender-briefings', label: 'Compulsory briefings guide' },
    { href: '/tenders/kwazulu-natal', label: 'KwaZulu-Natal tenders' },
    { href: '/resources/why-smes-miss-tender-opportunities', label: 'Why SMEs miss tenders' },
  ],
  tenderSectionTitle: 'Live compulsory briefings nationwide',
  tenderSectionIntro:
    'Recent government tenders with mandatory briefing requirements across South African provinces — synced from official eTenders publication data.',
}
