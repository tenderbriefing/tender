/**
 * Canonical organisation SEO registry for Phase 2B.
 * Seeded only from live production volume audit (2026-08-28).
 * Add future organisations here when they meet the indexing threshold.
 */

export type OrganisationSeoEntry = {
  /** Stable URL slug — never change without redirect plan. */
  slug: string
  /** Display name used in H1 / titles. */
  displayName: string
  /** Short label for nav chips when useful. */
  shortName: string
  /** Exact department/buyer strings observed in production (case-insensitive match). */
  aliases: string[]
}

/** Normalise buyer/department strings for matching. */
export function normaliseOrganisationLabel(value?: string | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Qualifying organisations from bounded production catalogue audit.
 * Threshold applied at page/sitemap time; registry only lists approved candidates.
 */
export const ORGANISATION_SEO_REGISTRY: OrganisationSeoEntry[] = [
  {
    slug: 'dbsa',
    displayName: 'Development Bank of Southern Africa',
    shortName: 'DBSA',
    aliases: ['Development Bank of Southern Africa', 'DBSA'],
  },
  {
    slug: 'public-works',
    displayName: 'Public Works',
    shortName: 'Public Works',
    aliases: ['Public Works'],
  },
  {
    slug: 'hwseta',
    displayName: 'Health and Welfare Sector Education and Training Authority',
    shortName: 'HWSETA',
    aliases: [
      'Health and Welfare Sector Education and Training Authority',
      'HWSETA',
    ],
  },
  {
    slug: 'thulamela-local-municipality',
    displayName: 'Thulamela Local Municipality',
    shortName: 'Thulamela',
    aliases: ['Thulamela Local Municipality'],
  },
  {
    slug: 'prasa',
    displayName: 'Passenger Rail Agency of South Africa',
    shortName: 'PRASA',
    aliases: [
      'Passenger Rail Agency of South Africa',
      'PRASA',
      'Passenger Rail Agency of South Africa (PRASA)',
    ],
  },
  {
    slug: 'drakenstein-municipality',
    displayName: 'Drakenstein Municipality',
    shortName: 'Drakenstein',
    aliases: ['Drakenstein Municipality'],
  },
  {
    slug: 'kzn-economic-development',
    displayName: 'KwaZulu-Natal Economic Development, Tourism and Environmental Affairs',
    shortName: 'KZN EDTEA',
    aliases: [
      'Kwazulu Natal - Economic Development, Tourism and Environ Affairs',
      'KwaZulu-Natal Economic Development, Tourism and Environmental Affairs',
    ],
  },
  {
    slug: 'sanbi',
    displayName: 'South African National Biodiversity Institute',
    shortName: 'SANBI',
    aliases: ['South African National Biodiversity Institute', 'SANBI'],
  },
  {
    slug: 'greater-kokstad-local-municipality',
    displayName: 'Greater Kokstad Local Municipality',
    shortName: 'Greater Kokstad',
    aliases: ['Greater Kokstad Local Municipality'],
  },
  {
    slug: 'zululand-district-municipality',
    displayName: 'Zululand District Municipality',
    shortName: 'Zululand',
    aliases: ['Zululand District Municipality'],
  },
  {
    slug: 'stellenbosch-municipality',
    displayName: 'Stellenbosch Municipality',
    shortName: 'Stellenbosch',
    aliases: ['Stellenbosch Municipality'],
  },
  {
    slug: 'johannesburg-city-parks-and-zoo',
    displayName: 'Johannesburg City Parks and Zoo',
    shortName: 'City Parks and Zoo',
    aliases: ['Johannesburg City Parks and Zoo'],
  },
  {
    slug: 'umzimkhulu-local-municipality',
    displayName: 'Umzimkhulu Local Municipality',
    shortName: 'Umzimkhulu',
    aliases: ['Umzimkhulu Local Municipality'],
  },
  {
    slug: 'cticc',
    displayName: 'Cape Town International Convention Centre',
    shortName: 'CTICC',
    aliases: ['Cape Town International Convention Centre', 'CTICC'],
  },
  {
    slug: 'eskom',
    displayName: 'Eskom',
    shortName: 'Eskom',
    aliases: ['ESKOM', 'Eskom', 'Eskom Holdings SOC Ltd', 'Eskom Holdings'],
  },
  {
    slug: 'gert-sibande-district-municipality',
    displayName: 'Gert Sibande District Municipality',
    shortName: 'Gert Sibande',
    aliases: ['Gert Sibande District Municipality'],
  },
  {
    slug: 'breede-valley-municipality',
    displayName: 'Breede Valley Municipality',
    shortName: 'Breede Valley',
    aliases: ['Breede Valley Municipality'],
  },
  {
    slug: 'eastern-cape-education',
    displayName: 'Eastern Cape Education',
    shortName: 'EC Education',
    aliases: ['Eastern Cape - Education', 'Eastern Cape Education'],
  },
]

const BY_SLUG: Record<string, OrganisationSeoEntry> = Object.fromEntries(
  ORGANISATION_SEO_REGISTRY.map((entry) => [entry.slug, entry])
)

/** Map normalised alias → registry entry (first wins; registry order is intentional). */
const BY_ALIAS: Map<string, OrganisationSeoEntry> = (() => {
  const map = new Map<string, OrganisationSeoEntry>()
  for (const entry of ORGANISATION_SEO_REGISTRY) {
    for (const alias of entry.aliases) {
      const key = normaliseOrganisationLabel(alias)
      if (key && !map.has(key)) map.set(key, entry)
    }
    const displayKey = normaliseOrganisationLabel(entry.displayName)
    if (displayKey && !map.has(displayKey)) map.set(displayKey, entry)
  }
  return map
})()

export function getOrganisationBySlug(slug: string): OrganisationSeoEntry | null {
  return BY_SLUG[slug.trim().toLowerCase()] ?? null
}

export function resolveOrganisationFromTender(tender: {
  department?: string | null
  buyer?: string | null
}): OrganisationSeoEntry | null {
  const dept = normaliseOrganisationLabel(tender.department)
  const buyer = normaliseOrganisationLabel(tender.buyer)
  if (dept && BY_ALIAS.has(dept)) return BY_ALIAS.get(dept)!
  if (buyer && BY_ALIAS.has(buyer)) return BY_ALIAS.get(buyer)!
  return null
}

export function organisationMatchesEntry(
  tender: { department?: string | null; buyer?: string | null },
  entry: OrganisationSeoEntry
): boolean {
  const resolved = resolveOrganisationFromTender(tender)
  return resolved?.slug === entry.slug
}

export function allOrganisationSlugs(): string[] {
  return ORGANISATION_SEO_REGISTRY.map((e) => e.slug)
}
