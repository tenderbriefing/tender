import type { SeoLandingConfig } from '@/lib/seo/landingTypes'
import {
  AGENT_DELEGATION_FAQ,
  ETENDERS_FAQ,
  R249_FAQ,
  SME_FREE_FAQ,
} from './shared'

export const rfqConfig: SeoLandingConfig = {
  slug: 'rfq-briefing-support',
  path: '/rfq-briefing-support',
  metaDescription:
    'RFQ briefing support for South African SMEs. Track Request for Quotation opportunities with compulsory sessions, manage private RFQs and request Youth Agent attendance for R249 on TenderBriefing.',
  eyebrow: 'RFQ · Quotations',
  title: 'RFQ Briefing Support for South African SMEs',
  heroDescription:
    'Request for Quotation processes often include briefing or clarification meetings. TenderBriefing helps SMEs track RFQ compliance, read official scope from eTenders and request Youth Agents when attendance is mandatory.',
  heroPrimaryCta: 'Track RFQ briefings free',
  heroSecondaryCta: 'Browse RFQ opportunities',
  intro:
    'Not every government opportunity is a multi-stage open tender. Request for Quotation (RFQ) and selective quotation processes appear daily on eTenders — especially for goods, maintenance, professional services and emergency purchases — and many still require briefing attendance or clarification sessions that carry the same disqualification risk as formal tenders. TenderBriefing supports RFQ briefing compliance for SMEs: public RFQs synced from official feeds, private RFQ inbox for direct opportunities, verbatim scope text, and Youth Agent attendance when you cannot join the session in person — all with free discovery and R249 only when you confirm agent support.',
  sections: [
    {
      heading: 'How RFQs differ from formal tenders — and where briefings still matter',
      paragraphs: [
        'RFQs typically seek faster pricing on defined scopes with lighter documentation than full tenders, but procuring entities still use briefings to clarify specifications, delivery locations and submission format. When marked compulsory, the same attendance rules apply.',
        'RFQ language appears in procurement method fields, titles and descriptions — TenderBriefing filters RFQ-related compulsory briefings so SMEs focused on quotation work see relevant sessions without wading through unrelated construction megaprojects.',
        'Private RFQs sent directly to your business also land in the SME RFQ inbox on TenderBriefing — keeping public and private quotation pipelines in one operational view.',
      ],
    },
    {
      heading: 'Public eTenders RFQs versus private RFQ inbox',
      paragraphs: [
        'Public RFQs publish on eTenders like any opportunity: tender number, department, closing date, documents and optional or compulsory briefing details. TenderBriefing syncs these records for free SME browsing.',
        'Private RFQs arrive via email or direct invitation — common in repeat supplier relationships. Registered SMEs can manage these inside TenderBriefing without losing track of briefing dates buried in threads.',
        'Both channels demand attendance discipline. A missed RFQ briefing can waste days preparing a quote that never gets opened.',
      ],
    },
    {
      heading: 'RFQ briefing compliance workflow',
      paragraphs: [
        'Shortlist RFQs with realistic delivery capacity and margin. Open official documents immediately — RFQ scopes are tighter but errors are costlier because timelines are shorter.',
        'If briefing is compulsory, calendar it before pricing. For virtual RFQ clarifications, test meeting links early; departments often start precisely on time with limited replay.',
        'When attendance conflicts with operations, request a Youth Agent for R249 and feed agent notes directly into your quotation template.',
      ],
    },
    {
      heading: 'Benefits of TenderBriefing for RFQ-heavy SMEs',
      paragraphs: [
        'Suppliers running high RFQ volume — stationery, PPE, plumbing parts, ICT consumables — need speed without sacrificing compliance. TenderBriefing surfaces briefing flags early in the RFQ lifecycle.',
        'Official description text is shown verbatim so your quote matches entity terminology — reducing rejection for non-compliant specs.',
        'Internal links connect RFQ support with compulsory briefing guides, agent services and resources explaining PFMA quotation thresholds.',
      ],
    },
    {
      heading: 'Common RFQ briefing pitfalls',
      paragraphs: [
        'Assuming RFQ means no site visit — many maintenance RFQs include compulsory site meetings.',
        'Quoting from advert summary instead of full PDF specifications — TenderBriefing links documents on every detail page.',
        'Ignoring addenda published after RFQ briefings — monitor tender history until closing.',
        'Double-booking RFQ briefings across departments — use agent attendance strategically.',
      ],
    },
  ],
  authority: {
    heading: 'Quotation suppliers deserve the same briefing intelligence as tier-one bidders',
    paragraphs: [
      'RFQ processes keep government running between major tenders. SMEs winning quotation work often grow into long-term panel suppliers — but only if they stay compliant on briefings from the first RFQ.',
      'TenderBriefing treats RFQs as first-class opportunities with compulsory session tracking, not as second-tier adverts. Combined with private RFQ inbox features, it is a practical RFQ briefing support layer for South African suppliers.',
    ],
  },
  smeGuidance: {
    title: 'RFQ SME quick guide',
    items: [
      {
        title: 'Speed with compliance',
        text: 'RFQ windows are short — confirm briefing requirements in the first fifteen minutes of review.',
      },
      {
        title: 'Use private inbox',
        text: 'Forward or capture private RFQs in TenderBriefing so briefing dates are not lost in email.',
      },
      {
        title: 'Agents for volume',
        text: 'High RFQ volume businesses use R249 agents to cover simultaneous compulsory clarifications.',
      },
      {
        title: 'Match official specs',
        text: 'Quote from verbatim scope on detail pages — terminology mismatches cause RFQ rejection.',
      },
    ],
  },
  processSteps: [
    {
      step: '1',
      title: 'Filter RFQ opportunities',
      text: 'Browse RFQ-related compulsory briefings on this page and /tenders.',
    },
    {
      step: '2',
      title: 'Review specs and briefing rules',
      text: 'Download PDFs; note compulsory vs optional clarification sessions.',
    },
    {
      step: '3',
      title: 'Attend or delegate',
      text: 'Join briefing, or request Youth Agent attendance for R249.',
    },
    {
      step: '4',
      title: 'Prepare quotation',
      text: 'Incorporate clarifications and agent notes into pricing and delivery terms.',
    },
    {
      step: '5',
      title: 'Submit before closing',
      text: 'Upload via eTenders or method specified in the RFQ documents.',
    },
  ],
  useCases: [
    {
      title: 'Medical consumables RFQ',
      scenario:
        'Provincial health department RFQ with compulsory Teams clarification on packaging specs.',
      outcome:
        'SME joins via link from TenderBriefing; quotes compliant labelling requirements.',
    },
    {
      title: 'Private RFQ from municipality',
      scenario:
        'Repeat cleaning supplier receives direct RFQ email with site briefing next week.',
      outcome:
        'Logged in private RFQ inbox; owner requests agent when unavailable.',
    },
    {
      title: 'ICT hardware RFQ cluster',
      scenario:
        'Reseller tracks multiple RFQs with overlapping briefing times.',
      outcome:
        'Agents cover two sessions at R249 each; director attends highest-value third.',
    },
  ],
  provinceFocus: [],
  highlights: [
    'RFQ and quotation opportunities with briefing requirements',
    'Private RFQ inbox for registered SMEs',
    'Official scope and documents from eTenders',
    'Compulsory briefing flags and calendar dates',
    'Youth Agent support for R249 per session',
  ],
  features: [
    {
      title: 'RFQ-aware filtering',
      text: 'Focus on Request for Quotation opportunities with briefing compliance needs.',
    },
    {
      title: 'Private RFQ management',
      text: 'Track direct quotation invites alongside public eTenders sync.',
    },
    {
      title: 'Fast document access',
      text: 'Specifications and clarifications on detail pages — critical for short RFQ windows.',
    },
    {
      title: 'Agent scalability',
      text: 'Cover multiple RFQ briefings when quotation volume spikes.',
    },
  ],
  faqs: [
    SME_FREE_FAQ,
    R249_FAQ,
    {
      question: 'Does TenderBriefing handle private RFQs?',
      answer:
        'Yes. Registered SMEs can receive and manage private RFQ opportunities in addition to public eTenders compulsory briefings.',
    },
    ETENDERS_FAQ,
    AGENT_DELEGATION_FAQ,
    {
      question: 'Are RFQ briefings always compulsory?',
      answer:
        'No. Some RFQs only recommend clarifications. Always read the official PDF — TenderBriefing highlights compulsory flags when detected.',
    },
    {
      question: 'How is RFQ briefing support different from open tender support?',
      answer:
        'The attendance compliance rules are the same; RFQs typically have shorter closing windows and tighter specifications requiring faster briefing response.',
    },
    {
      question: 'Can I filter only RFQ opportunities?',
      answer:
        'This page lists live RFQ-related compulsory briefings. Use /tenders and search for broader quotation discovery.',
    },
    {
      question: 'What is the cost for RFQ briefing agent attendance?',
      answer:
        'Same fixed R249 per confirmed Youth Agent attendance request — discovery remains free.',
    },
  ],
  ctaTitle: 'Stay compliant on RFQ briefings without slowing quotes',
  ctaDescription:
    'Free RFQ and tender discovery for SMEs — R249 Youth Agent attendance only when a compulsory RFQ briefing requires it.',
  ctaPrimaryLabel: 'Register for RFQ support',
  ctaSecondaryLabel: 'View RFQ briefings live',
  relatedLinks: [
    { href: '/tender-briefing-agent', label: 'Briefing agents' },
    { href: '/compulsory-tender-briefings', label: 'Compulsory briefings' },
    { href: '/resources', label: 'Procurement articles' },
  ],
  tenderSectionTitle: 'Live RFQ opportunities with briefing requirements',
  tenderSectionIntro:
    'Request for Quotation and related opportunities from eTenders where briefing or clarification attendance applies — with department, province and closing details.',
}
