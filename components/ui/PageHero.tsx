import SectionLabel from './SectionLabel'

interface PageHeroProps {
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: 'center' | 'left'
  tone?: 'light' | 'dark'
  children?: React.ReactNode
}

export default function PageHero({
  eyebrow,
  title,
  description,
  align = 'center',
  tone = 'light',
  children,
}: PageHeroProps) {
  const isDark = tone === 'dark'
  const wrapper = isDark
    ? 'bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white'
    : 'bg-gradient-to-b from-white via-brand-50/40 to-white text-brand-900'
  const titleColor = isDark ? 'text-white' : 'text-brand-900'
  const descColor = isDark ? 'text-brand-100/80' : 'text-slate-600'
  const alignment = align === 'center' ? 'text-center items-center mx-auto' : 'text-left items-start'

  return (
    <section className={`relative overflow-hidden border-b border-brand-100/40 ${wrapper}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-32 -right-24 h-72 w-72 rounded-full blur-3xl ${isDark ? 'bg-accent-500/20' : 'bg-brand-200/40'}`} />
        <div className={`absolute -bottom-32 -left-24 h-72 w-72 rounded-full blur-3xl ${isDark ? 'bg-brand-500/30' : 'bg-accent-100/50'}`} />
        <svg
          aria-hidden
          className={`absolute inset-0 h-full w-full ${isDark ? 'opacity-[0.07]' : 'opacity-[0.05]'}`}
        >
          <defs>
            <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M0 32V0h32" fill="none" stroke={isDark ? '#D4AF37' : '#0F1E3D'} strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
      </div>

      <div className={`relative mx-auto flex max-w-4xl flex-col gap-5 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24 ${alignment}`}>
        <SectionLabel tone={isDark ? 'light' : 'navy'}>{eyebrow}</SectionLabel>
        <h1 className={`text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1] ${titleColor}`}>
          {title}
        </h1>
        {description && (
          <p className={`max-w-2xl text-lg leading-relaxed ${descColor}`}>{description}</p>
        )}
        {children}
      </div>
    </section>
  )
}
