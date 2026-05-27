import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import GlobalStructuredData from '@/components/seo/GlobalStructuredData'
import { Toaster } from 'react-hot-toast'
import { GOOGLE_SITE_VERIFICATION, SITE_URL } from '@/lib/seo/site'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Tender Briefing South Africa | Compulsory Government Tender Briefings',
    template: '%s | TenderBriefing',
  },
  description:
    'TenderBriefing helps South African SMEs discover compulsory tender briefings, track official eTenders opportunities and request Youth Agents for R249 when attendance is required.',
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
    title: 'Tender Briefing South Africa | Compulsory Government Tender Briefings',
    description:
      'Discover compulsory government tender briefings across South Africa. Free for SMEs — R249 only when requesting a Youth Agent.',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tender Briefing South Africa | TenderBriefing',
    description:
      'Compulsory tender briefings, official eTenders data and Youth Agent attendance support for South African SMEs.',
    images: ['/logo.png'],
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/icon.png',
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
    <html lang="en-ZA" className="scroll-smooth">
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
