export default function TenderTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="hidden lg:block">
        <div className="h-10 bg-slate-100 border-b border-slate-200" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-slate-100 p-4">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-4 flex-1 rounded" />
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-4 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="lg:hidden space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-48 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
