/**
 * Catalogue layout — page-level generateMetadata owns title/robots.
 * Canonical for all /tenders variants remains /tenders (see page.tsx).
 * Search query params (?q=, ?province=) are noindex to avoid SEO bloat.
 */
export default function TendersLayout({ children }: { children: React.ReactNode }) {
  return children
}
