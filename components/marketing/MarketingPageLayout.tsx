import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import AnimateIn from '@/components/ui/AnimateIn'
import PageHero from '@/components/ui/PageHero'

interface MarketingPageLayoutProps {
  eyebrow: string
  title: string
  description: string
  heroTone?: 'light' | 'dark'
  heroExtra?: React.ReactNode
  children?: React.ReactNode
}

export default function MarketingPageLayout({
  eyebrow,
  title,
  description,
  heroTone = 'light',
  heroExtra,
  children,
}: MarketingPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <PageHero eyebrow={eyebrow} title={title} description={description} tone={heroTone}>
          {heroExtra}
        </PageHero>
        {children && (
          <section className="py-16 lg:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <AnimateIn>{children}</AnimateIn>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
