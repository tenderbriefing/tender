import { notFound } from 'next/navigation'

/**
 * Catch-all for unmatched /admin/* paths.
 * Triggers app/admin/not-found.tsx (Operations recovery) instead of the public 404.
 * More specific admin routes take precedence over this segment.
 */
export default function AdminCatchAllPage() {
  notFound()
}
