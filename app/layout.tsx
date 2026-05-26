import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TenderBriefing | South Africa Tender Briefing Intelligence Platform',
    template: '%s | TenderBriefing',
  },
  description:
    'Discover compulsory government tender briefings, site meetings, and procurement opportunities across South Africa.',
  keywords: [
    'tender briefing',
    'government tenders South Africa',
    'compulsory briefing',
    'procurement intelligence',
    'SME tenders',
    'youth agents',
    'eTenders',
  ],
  authors: [{ name: 'TenderBriefing' }],
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: siteUrl,
    siteName: 'TenderBriefing',
    title: 'TenderBriefing | South Africa Tender Briefing Intelligence Platform',
    description:
      'Discover compulsory government tender briefings, site meetings, and procurement opportunities across South Africa.',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenderBriefing | South Africa Tender Briefing Intelligence Platform',
    description:
      'Discover compulsory government tender briefings, site meetings, and procurement opportunities across South Africa.',
    images: ['/logo.png'],
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
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
