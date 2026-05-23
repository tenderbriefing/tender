import { TenderSource } from './types'

export const TENDER_SOURCES: TenderSource[] = [
  {
    name: 'Government Tender Portal',
    baseUrl: 'https://www.etenders.gov.za',
    searchUrl: 'https://www.etenders.gov.za/Home/opportunities',
    selectors: {
      tenderList: '.tender-item',
      tenderTitle: '.tender-title',
      tenderDescription: '.tender-description',
      tenderOrganization: '.tender-organization',
      tenderLocation: '.tender-location',
      tenderDeadline: '.tender-deadline',
      tenderValue: '.tender-value',
      tenderCategory: '.tender-category',
      tenderContact: '.tender-contact',
      briefingInfo: '.briefing-info'
    },
    filters: {
      keywords: ['briefing', 'compulsory', 'mandatory', 'information session'],
      excludeKeywords: ['cancelled', 'postponed', 'withdrawn'],
      minValue: 10000,
      categories: ['Construction', 'Technology', 'Services', 'Consulting']
    },
    pagination: {
      type: 'numbered',
      maxPages: 10
    }
  },
  {
    name: 'National Treasury',
    baseUrl: 'https://www.treasury.gov.za',
    searchUrl: 'https://www.treasury.gov.za/tenders',
    selectors: {
      tenderList: '.tender-listing',
      tenderTitle: '.tender-title',
      tenderDescription: '.tender-summary',
      tenderOrganization: '.department',
      tenderLocation: '.location',
      tenderDeadline: '.closing-date',
      tenderValue: '.estimated-value',
      tenderCategory: '.category',
      tenderContact: '.contact-person',
      briefingInfo: '.briefing-details'
    },
    filters: {
      keywords: ['briefing', 'compulsory', 'information session', 'clarification'],
      excludeKeywords: ['cancelled', 'postponed'],
      minValue: 50000
    }
  },
  {
    name: 'Provincial Government Portals',
    baseUrl: 'https://www.gauteng.gov.za',
    searchUrl: 'https://www.gauteng.gov.za/tenders',
    selectors: {
      tenderList: '.tender-card',
      tenderTitle: '.card-title',
      tenderDescription: '.card-description',
      tenderOrganization: '.issuing-department',
      tenderLocation: '.tender-location',
      tenderDeadline: '.closing-date',
      tenderValue: '.estimated-value',
      tenderCategory: '.tender-type',
      tenderContact: '.contact-info',
      briefingInfo: '.briefing-session'
    },
    filters: {
      keywords: ['briefing', 'compulsory', 'mandatory', 'information'],
      excludeKeywords: ['cancelled', 'postponed', 'withdrawn'],
      minValue: 25000
    }
  },
  {
    name: 'Municipal Tenders',
    baseUrl: 'https://www.joburg.org.za',
    searchUrl: 'https://www.joburg.org.za/tenders',
    selectors: {
      tenderList: '.tender-item',
      tenderTitle: '.tender-title',
      tenderDescription: '.tender-description',
      tenderOrganization: '.municipality',
      tenderLocation: '.area',
      tenderDeadline: '.deadline',
      tenderValue: '.value',
      tenderCategory: '.category',
      tenderContact: '.contact',
      briefingInfo: '.briefing'
    },
    filters: {
      keywords: ['briefing', 'compulsory', 'information session'],
      excludeKeywords: ['cancelled', 'postponed'],
      minValue: 10000
    }
  },
  {
    name: 'Private Sector Tenders',
    baseUrl: 'https://www.tenders.co.za',
    searchUrl: 'https://www.tenders.co.za/search',
    selectors: {
      tenderList: '.tender-result',
      tenderTitle: '.tender-title',
      tenderDescription: '.tender-description',
      tenderOrganization: '.company',
      tenderLocation: '.location',
      tenderDeadline: '.closing-date',
      tenderValue: '.estimated-value',
      tenderCategory: '.industry',
      tenderContact: '.contact-details',
      briefingInfo: '.briefing-info'
    },
    filters: {
      keywords: ['briefing', 'compulsory', 'information session', 'clarification meeting'],
      excludeKeywords: ['cancelled', 'postponed', 'withdrawn'],
      minValue: 20000
    }
  }
]

export const SCRAPING_CONFIG = {
  sources: TENDER_SOURCES,
  updateInterval: 60, // 1 hour
  maxRetries: 3,
  timeout: 30000 // 30 seconds
}

export const BRIEFING_KEYWORDS = [
  'compulsory briefing',
  'mandatory briefing',
  'information session',
  'clarification meeting',
  'briefing session',
  'tender briefing',
  'compulsory information session',
  'mandatory information session',
  'pre-bid meeting',
  'site visit',
  'clarification session'
]

export const CATEGORY_MAPPING = {
  'Construction': ['construction', 'building', 'infrastructure', 'civil works', 'engineering'],
  'Technology': ['technology', 'IT', 'software', 'hardware', 'digital', 'telecommunications'],
  'Services': ['services', 'consulting', 'professional services', 'maintenance', 'cleaning'],
  'Healthcare': ['healthcare', 'medical', 'health', 'pharmaceutical', 'hospital'],
  'Education': ['education', 'training', 'learning', 'school', 'university'],
  'Transportation': ['transport', 'logistics', 'shipping', 'aviation', 'railway'],
  'Energy': ['energy', 'power', 'electricity', 'renewable', 'solar', 'wind'],
  'Agriculture': ['agriculture', 'farming', 'food', 'livestock', 'crops'],
  'Manufacturing': ['manufacturing', 'production', 'industrial', 'factory'],
  'Other': ['other', 'miscellaneous', 'general']
}
