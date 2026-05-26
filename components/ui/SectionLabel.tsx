interface SectionLabelProps {
  children: React.ReactNode
  className?: string
  tone?: 'navy' | 'gold' | 'light'
}

export default function SectionLabel({
  children,
  className = '',
  tone = 'navy',
}: SectionLabelProps) {
  const colors = {
    navy: 'text-brand-800',
    gold: 'text-accent-600',
    light: 'text-white/80',
  }
  const dotColors = {
    navy: 'bg-accent-500',
    gold: 'bg-brand-800',
    light: 'bg-accent-400',
  }
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${colors[tone]} ${className}`}
    >
      <span className={`h-1.5 w-6 rounded-full ${dotColors[tone]}`} />
      {children}
    </span>
  )
}
