import type { Metadata } from 'next'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { buildPageMetadata } from './metadata'

export interface ProgrammaticTenderPageConfig {
  slug: string
  title: string
  metaDescription: string
  eyebrow: string
  heroTitle: string
  heroDescription: string
  seoCopy: string[]
  filter: (tender: TenderBriefing) => boolean
  searchHint?: string
}

export const PROGRAMMATIC_TENDER_PAGES: Record<string, ProgrammaticTenderPageConfig> = {
  gauteng: {
    slug: 'gauteng',
    title: 'Gauteng Tender Briefings',
    metaDescription:
      'Browse compulsory tender briefings in Gauteng. Free SME discovery on TenderBriefing with official eTenders data, briefing dates and Youth Agent support for R249.',
    eyebrow: 'Gauteng · Provincial tenders',
    heroTitle: 'Gauteng tender briefings & compulsory site meetings',
    heroDescription:
      'Discover government tender opportunities with compulsory briefings in Gauteng — including Pretoria, Johannesburg and Midrand procuring entities.',
    seoCopy: [
      'Gauteng is South Africa’s economic hub with high tender activity across national departments, metros and SOEs.',
      'TenderBriefing surfaces compulsory briefing opportunities in Gauteng with official dates, times, documents and scope of work from eTenders.',
      'Registration is free for SMEs. Request a Youth Agent for R249 only when you need someone to attend a compulsory briefing on your behalf.',
    ],
    filter: (t) => t.province === 'Gauteng',
  },
  'western-cape': {
    slug: 'western-cape',
    title: 'Western Cape Tender Briefings',
    metaDescription:
      'Find compulsory tender briefings in the Western Cape. Track Cape Town and provincial government opportunities on TenderBriefing — free for SMEs.',
    eyebrow: 'Western Cape · Provincial tenders',
    heroTitle: 'Western Cape tender briefings',
    heroDescription:
      'Track compulsory government tender briefings across the Western Cape including Cape Town, Stellenbosch and provincial departments.',
    seoCopy: [
      'Western Cape procuring entities publish tenders with compulsory briefings for construction, services and goods.',
      'Use TenderBriefing to see official descriptions, briefing schedules and closing dates without missing compliance windows.',
    ],
    filter: (t) => t.province === 'Western Cape',
  },
  'kwazulu-natal': {
    slug: 'kwazulu-natal',
    title: 'KwaZulu-Natal Tender Briefings',
    metaDescription:
      'Browse compulsory tender briefings in KwaZulu-Natal. Official eTenders data on TenderBriefing — free discovery, R249 agent fee when needed.',
    eyebrow: 'KwaZulu-Natal · Provincial tenders',
    heroTitle: 'KwaZulu-Natal tender briefings',
    heroDescription:
      'Find compulsory briefing opportunities across KZN including Durban, Pietermaritzburg and provincial municipalities.',
    seoCopy: [
      'KwaZulu-Natal publishes regular government tenders with compulsory briefing requirements across infrastructure, services and supplies.',
      'TenderBriefing helps SMEs filter KZN opportunities and plan attendance or request a Youth Agent when required.',
    ],
    filter: (t) => t.province === 'KwaZulu-Natal',
  },
  construction: {
    slug: 'construction',
    title: 'Construction Tender Briefings South Africa',
    metaDescription:
      'Construction and civil works tender briefings in South Africa. Compulsory site meetings and briefing dates on TenderBriefing — free for SMEs.',
    eyebrow: 'Construction · Works tenders',
    heroTitle: 'Construction & civil works tender briefings',
    heroDescription:
      'Compulsory briefings for construction, demolition, roads and building works tenders across South Africa.',
    seoCopy: [
      'Construction tenders frequently require compulsory site briefings or pre-bid meetings.',
      'TenderBriefing highlights these opportunities with official scope descriptions, documents and briefing logistics.',
    ],
    filter: (t) => {
      const hay = `${t.category} ${t.industrySector} ${t.description} ${t.title}`.toLowerCase()
      return /construction|civil|building|demolition|works|infrastructure|road/.test(hay)
    },
  },
  ict: {
    slug: 'ict',
    title: 'ICT Tender Briefings South Africa',
    metaDescription:
      'ICT and technology tender briefings in South Africa. Track compulsory briefing sessions for software, hardware and IT services on TenderBriefing.',
    eyebrow: 'ICT · Technology tenders',
    heroTitle: 'ICT & technology tender briefings',
    heroDescription:
      'Government ICT tenders with compulsory briefings — software, hardware, connectivity and IT professional services.',
    seoCopy: [
      'ICT procurements often include clarification or compulsory briefing sessions for bidders.',
      'Browse official opportunities synced from eTenders and request Youth Agent attendance support when needed.',
    ],
    filter: (t) => {
      const hay = `${t.category} ${t.industrySector} ${t.description} ${t.title}`.toLowerCase()
      return /ict|information technology|software|hardware|it services|telecom|network|computer/.test(hay)
    },
  },
  'security-services': {
    slug: 'security-services',
    title: 'Security Services Tender Briefings',
    metaDescription:
      'Security services tender briefings in South Africa. Guarding, monitoring and protection service opportunities with compulsory briefings on TenderBriefing.',
    eyebrow: 'Security · Services tenders',
    heroTitle: 'Security services tender briefings',
    heroDescription:
      'Track guarding, access control and security service tenders with compulsory briefing requirements nationwide.',
    seoCopy: [
      'Security service tenders are published regularly by government departments, schools and municipalities.',
      'TenderBriefing shows briefing dates, official scope and documents so your security business can bid compliantly.',
    ],
    filter: (t) => {
      const hay = `${t.category} ${t.industrySector} ${t.description} ${t.title}`.toLowerCase()
      return /security|guarding|protection services|access control/.test(hay)
    },
  },
  'cleaning-services': {
    slug: 'cleaning-services',
    title: 'Cleaning Services Tender Briefings',
    metaDescription:
      'Cleaning and hygiene services tender briefings in South Africa. Compulsory briefing opportunities for SMEs on TenderBriefing — free to browse.',
    eyebrow: 'Cleaning · Services tenders',
    heroTitle: 'Cleaning services tender briefings',
    heroDescription:
      'Hygiene, cleaning and facilities services tenders with compulsory briefing sessions across South Africa.',
    seoCopy: [
      'Cleaning services are a high-volume category in South African public procurement.',
      'Use TenderBriefing to find compulsory briefings, read official tender descriptions and plan agent attendance if required.',
    ],
    filter: (t) => {
      const hay = `${t.category} ${t.industrySector} ${t.description} ${t.title}`.toLowerCase()
      return /cleaning|hygiene|janitorial|facilities management|sanitation/.test(hay)
    },
  },
}

export function buildProgrammaticMetadata(config: ProgrammaticTenderPageConfig): Metadata {
  return buildPageMetadata({
    title: config.title,
    description: config.metaDescription,
    path: `/tenders/${config.slug}`,
    keywords: [
      config.title,
      'tender briefing South Africa',
      'compulsory tender briefings',
      'government tenders',
    ],
  })
}

export const PROGRAMMATIC_SLUGS = Object.keys(PROGRAMMATIC_TENDER_PAGES)
