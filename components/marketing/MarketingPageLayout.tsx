import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import AnimateIn from '@/components/ui/AnimateIn'

interface MarketingPageLayoutProps {
  eyebrow: string
  title: string
  description: string
  children?: React.ReactNode
}

export default function MarketingPageLayout({
  eyebrow,
  title,
  description,
  children,
}: MarketingPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <section className="border-b border-slate-100 bg-gradient-to-b from-brand-50/50 to-white py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <AnimateIn>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
                {eyebrow}
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-lg text-slate-600 leading-relaxed">{description}</p>
            </AnimateIn>
          </div>
        </section>
        {children && (
          <section className="py-16 lg:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
