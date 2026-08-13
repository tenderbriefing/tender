import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Development email gallery — fixture previews only.
 * Disabled in production unless ALLOW_DEV_EMAIL_PREVIEW=true.
 */
export default function DevEmailsPage({
  searchParams,
}: {
  searchParams?: { id?: string; width?: string }
}) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_EMAIL_PREVIEW !== 'true') {
    notFound()
  }

  // Shared CJS fixtures (allowJs)
  const { GALLERY } = require('@/lib/emails/fixtures') as {
    GALLERY: Array<{ id: string; label: string }>
  }

  const activeId = searchParams?.id || GALLERY[0]?.id
  const width = searchParams?.width === '390' ? 390 : 600
  const previewSrc = `/api/dev/emails?id=${encodeURIComponent(activeId || '')}`

  return (
    <main style={{ minHeight: '100vh', background: '#F1F5F9', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F1E3D', marginBottom: 8 }}>
          Transactional email gallery
        </h1>
        <p style={{ color: '#64748B', marginBottom: 20, fontSize: 14 }}>
          Fixture-only previews. Not available in production by default.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Link
            href={`/dev/emails?id=${activeId}&width=600`}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: width === 600 ? '#0F1E3D' : '#fff',
              color: width === 600 ? '#fff' : '#0F1E3D',
              border: '1px solid #E2E8F0',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Desktop 600
          </Link>
          <Link
            href={`/dev/emails?id=${activeId}&width=390`}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: width === 390 ? '#0F1E3D' : '#fff',
              color: width === 390 ? '#fff' : '#0F1E3D',
              border: '1px solid #E2E8F0',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Mobile 390
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
          <nav
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: 12,
              alignSelf: 'start',
            }}
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {GALLERY.map((item) => (
                <li key={item.id} style={{ marginBottom: 6 }}>
                  <Link
                    href={`/dev/emails?id=${item.id}&width=${width}`}
                    style={{
                      display: 'block',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: item.id === activeId ? '#F0F7FF' : 'transparent',
                      color: '#0F1E3D',
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: item.id === activeId ? 700 : 500,
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: 16,
              overflow: 'auto',
            }}
          >
            <iframe
              title="Email preview"
              src={previewSrc}
              style={{
                width,
                maxWidth: '100%',
                height: 900,
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                background: '#F1F5F9',
              }}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
