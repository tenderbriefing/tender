import type { ReactNode } from 'react'

export default function MobileActionBar({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden ${className}`}
      role="toolbar"
      aria-label="Primary actions"
    >
      <div className="mx-auto flex max-w-lg items-center gap-2">{children}</div>
    </div>
  )
}
