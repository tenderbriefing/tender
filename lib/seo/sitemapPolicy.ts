/**
 * Sitemap scaling policy for TenderBriefing tender URL volume.
 *
 * Current implementation (`app/sitemap.ts`):
 * - Single sitemap.xml
 * - Up to 5,000 indexable tender URLs via `getIndexableTenders()`
 * - `getIndexableTenders()` reads at most 2,000 records from storage before filtering
 *
 * Migration trigger — implement a sitemap index BEFORE eligible canonical tender URLs
 * can exceed the sitemap's 5,000 URL cap OR before `listTenderBriefingRecords(2000)`
 * can no longer retrieve all indexable compulsory records for sitemap generation.
 *
 * Recommended threshold: plan segmentation when indexable compulsory tender count
 * approaches 4,000 (80% of cap) or when Firestore indexable scan requires >2,000 reads.
 *
 * Future architecture:
 *   /sitemap.xml          → sitemap index
 *   /sitemap-static.xml   → homepage, marketing, resources, auth/signup
 *   /sitemap-landings.xml → SEO landing + programmatic browse pages
 *   /sitemap-tenders-active.xml
 *   /sitemap-tenders-historical.xml  (paginated segments if >50k URLs)
 *
 * Do not implement until volume requires it — monitor via catalogue summary aggregates.
 */

export const SITEMAP_TENDER_URL_CAP = 5000

export const SITEMAP_INDEXABLE_RECORD_SCAN_LIMIT = 2000

/** Plan sitemap index when indexable tenders exceed this count (80% of URL cap). */
export const SITEMAP_SEGMENTATION_PLANNING_THRESHOLD = 4000

export const SITEMAP_SEGMENTATION_TRIGGERS = [
  `Indexable compulsory tender count exceeds ${SITEMAP_SEGMENTATION_PLANNING_THRESHOLD}`,
  `Sitemap tender URL slice(0, ${SITEMAP_TENDER_URL_CAP}) truncates eligible records`,
  `getIndexableTenders() scan limit (${SITEMAP_INDEXABLE_RECORD_SCAN_LIMIT}) misses indexable records`,
] as const
