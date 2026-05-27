export interface ResourceArticle {
  slug: string
  title: string
  metaDescription: string
  excerpt: string
  publishedAt: string
  sections: Array<{ heading: string; paragraphs: string[] }>
  faqs?: Array<{ question: string; answer: string }>
}

export const RESOURCE_ARTICLES: ResourceArticle[] = [
  {
    slug: 'how-compulsory-tender-briefings-work',
    title: 'How Compulsory Tender Briefings Work in South Africa',
    metaDescription:
      'Learn how compulsory tender briefings work in South African government procurement, why attendance matters, and how SMEs can stay compliant with TenderBriefing.',
    excerpt:
      'A practical guide to compulsory tender briefings, disqualification risks, and how SMEs can plan attendance.',
    publishedAt: '2026-05-27',
    sections: [
      {
        heading: 'What is a compulsory tender briefing?',
        paragraphs: [
          'A compulsory tender briefing is an official meeting where a government procuring entity explains a tender opportunity before bids are submitted. When the briefing is marked compulsory, bidders who fail to attend may be disqualified regardless of price or compliance documents.',
          'Briefings may be physical site meetings or virtual sessions on platforms such as Microsoft Teams. The official requirements are always stated in the tender documents published on National Treasury eTenders.',
        ],
      },
      {
        heading: 'Why do procuring entities hold briefings?',
        paragraphs: [
          'Briefings clarify scope, safety requirements, site conditions and submission rules. For construction and infrastructure projects they help bidders understand access, timelines and technical constraints before pricing the work.',
          'For SMEs, briefings are also a chance to ask questions that reduce bid risk — but only if you attend before the closing date.',
        ],
      },
      {
        heading: 'How TenderBriefing helps SMEs',
        paragraphs: [
          'TenderBriefing syncs official eTenders data and highlights opportunities with compulsory briefing requirements. Each listing shows the official tender description, briefing date and time, venue or meeting link, documents and closing date.',
          'Discovery is free for SMEs. If you cannot attend in person, you can request a verified Youth Agent for a fixed R249 fee to attend on your behalf and return structured briefing notes.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I submit a bid if I miss a compulsory briefing?',
        answer:
          'In most cases, no. Treat compulsory briefings as mandatory unless the official tender documents explicitly state otherwise.',
      },
      {
        question: 'Where does TenderBriefing get briefing dates?',
        answer:
          'From the official National Treasury OCDS/eTenders feed, refreshed through automated sync.',
      },
    ],
  },
  {
    slug: 'why-smes-miss-tender-opportunities',
    title: 'Why SMEs Miss Tender Opportunities and How to Avoid It',
    metaDescription:
      'South African SMEs often miss tenders because of briefing attendance, short deadlines and scattered information. Learn how to avoid disqualification with TenderBriefing.',
    excerpt:
      'The most common reasons SMEs lose tender opportunities before evaluation — and practical steps to fix them.',
    publishedAt: '2026-05-27',
    sections: [
      {
        heading: 'Missing compulsory briefings',
        paragraphs: [
          'The fastest way to lose a tender is missing a compulsory briefing. Many SMEs discover an opportunity too late or assume documents alone are enough. TenderBriefing focuses on compulsory briefing opportunities so you see them early with dates and times upfront.',
        ],
      },
      {
        heading: 'Information overload on eTenders',
        paragraphs: [
          'The official eTenders portal lists thousands of opportunities. Filtering for compulsory briefings relevant to your province and sector takes time SMEs often do not have. TenderBriefing narrows the signal and presents official scope text, documents and key dates in one workflow.',
        ],
      },
      {
        heading: 'Capacity constraints',
        paragraphs: [
          'Owners and bid teams cannot be in two places at once. When a briefing clashes with operations, SMEs need a trusted representative. Youth Agents on TenderBriefing attend for a fixed R249 per session — still far cheaper than a lost contract.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Is TenderBriefing a replacement for reading tender documents?',
        answer:
          'No. Always review official PDFs and submission requirements. TenderBriefing helps you find and plan around compulsory briefings faster.',
      },
    ],
  },
  {
    slug: 'how-tenderbriefing-saves-time-on-site-briefings',
    title: 'How TenderBriefing Helps SMEs Save Time on Site Briefings',
    metaDescription:
      'TenderBriefing saves SMEs time by tracking compulsory briefings, centralising official eTenders data and offering Youth Agent attendance support for R249.',
    excerpt:
      'How to spend less time searching eTenders and more time preparing winning bids.',
    publishedAt: '2026-05-27',
    sections: [
      {
        heading: 'One place for compulsory briefing intelligence',
        paragraphs: [
          'Instead of manually scanning eTenders daily, TenderBriefing filters opportunities with compulsory briefing requirements and shows briefing date, time, venue and official scope on each tender detail page.',
        ],
      },
      {
        heading: 'Official data, SME-friendly workflow',
        paragraphs: [
          'Tender descriptions appear exactly as published on eTenders. Documents link directly to official downloads. SMEs register free, save opportunities and add briefings to calendar without paying a subscription.',
        ],
      },
      {
        heading: 'Agent attendance when you need it',
        paragraphs: [
          'When travel cost or scheduling makes attendance difficult, request a Youth Agent for R249. You receive briefing notes that help your team prepare a compliant submission without being physically present.',
        ],
      },
    ],
    faqs: [
      {
        question: 'What does the R249 fee cover?',
        answer:
          'A verified Youth Agent attending the compulsory briefing on your behalf and providing structured session notes through the platform.',
      },
    ],
  },
]

export const RESOURCE_ARTICLE_MAP = Object.fromEntries(
  RESOURCE_ARTICLES.map((article) => [article.slug, article])
) as Record<string, ResourceArticle>
