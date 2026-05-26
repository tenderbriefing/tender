import type { LucideIcon } from 'lucide-react'

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  tone?: 'default' | 'gold' | 'navy'
  className?: string
  children?: React.ReactNode
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  tone = 'default',
  className = '',
  children,
}: FeatureCardProps) {
  const cardTone = {
    default: 'border-slate-200 bg-white',
    gold: 'border-accent-200 bg-gradient-to-br from-accent-50/60 to-white',
    navy: 'border-brand-200 bg-gradient-to-br from-brand-50 to-white',
  }[tone]

  const iconTone = {
    default: 'bg-brand-50 text-brand-800 ring-brand-100',
    gold: 'bg-accent-100 text-accent-700 ring-accent-200',
    navy: 'bg-brand-900 text-accent-400 ring-brand-800',
  }[tone]

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border ${cardTone} p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${className}`}
    >
      <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-brand-800 to-accent-500 transition-transform duration-300 group-hover:scale-x-100" />
      <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-inset ${iconTone}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-lg font-bold text-brand-900">{title}</h3>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      )}
      {children}
    </article>
  )
}
