interface SkeletonProps {
  className?: string
  variant?: 'text' | 'rect' | 'circle'
}

export function Skeleton({ className = '', variant = 'rect' }: SkeletonProps) {
  const shape = {
    text: 'h-3 rounded-full',
    rect: 'rounded-xl',
    circle: 'rounded-full',
  }[variant]
  return (
    <span
      aria-hidden
      className={`block animate-pulse bg-gradient-to-r from-brand-100 via-slate-100 to-brand-100 ${shape} ${className}`}
    />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Skeleton variant="rect" className="h-10 w-10" />
      <Skeleton variant="text" className="mt-4 h-4 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={`mt-3 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonStatsRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <Skeleton variant="rect" className="h-10 w-10" />
          <Skeleton variant="text" className="mt-4 h-6 w-1/2" />
          <Skeleton variant="text" className="mt-2 h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}
