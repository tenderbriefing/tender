import AnimateIn from './AnimateIn'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  id?: string
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  id,
}: SectionHeadingProps) {
  const alignClass =
    align === 'center' ? 'text-center mx-auto max-w-3xl' : 'text-left max-w-none'

  return (
    <AnimateIn className={`mb-14 ${alignClass}`}>
      {eyebrow && (
        <p
          id={id}
          className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-800 mb-4"
        >
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">{description}</p>
      )}
    </AnimateIn>
  )
}
