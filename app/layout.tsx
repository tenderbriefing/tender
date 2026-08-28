import type { Metadata, Viewport } from 'next'
import { BRIEFING_PRICE_LABEL } from '@/lib/domain/briefingPricing'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import GlobalStructuredData from '@/components/seo/GlobalStructuredData'
import { Toaster } from 'react-hot-toast'
import { SITE_URL } from '@/lib/seo/site'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

/** Keep HTML ISR short so deploys don't leave CDNs serving stale chunk hashes. */
export const revalidate = 60

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Compulsory Tender Briefings for South African SMEs',
    template: '%s | TenderBriefing',
  },
  description:
    'Tender discovery and Youth Agent attendance for physical compulsory tender briefings across South Africa. Track official eTenders opportunities and request attendance support when required.',
  keywords: [
    'tender briefing',
    'tender briefing South Africa',
    'compulsory tender briefings',
    'government tenders South Africa',
    'eTenders',
    'SME tenders',
    'youth agent tender support',
  ],
  authors: [{ name: 'TenderBriefing' }],
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: SITE_URL,
    siteName: 'TenderBriefing',
    title: 'Compulsory Tender Briefings for South African SMEs | TenderBriefing',
    description: `Discover compulsory tender briefings across South Africa. Free SME registration — ${BRIEFING_PRICE_LABEL} only when requesting a Youth Agent for physical briefing attendance.`,
    images: ['/brand/og-logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compulsory Tender Briefings for South African SMEs | TenderBriefing',
    description:
      'Compulsory tender briefings, official eTenders data and Youth Agent attendance support for South African SMEs.',
    images: ['/brand/og-logo.png'],
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F1E3D',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-ZA" className={`scroll-smooth ${display.variable} ${inter.variable}`}>
      <body className={`${inter.className} antialiased text-slate-900 bg-white`}>
        <GlobalStructuredData />
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#0f172a', color: '#fff' },
              success: {
                duration: 3000,
                iconTheme: { primary: '#D4AF37', secondary: '#0F1E3D' },
              },
              error: {
                duration: 5000,
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
