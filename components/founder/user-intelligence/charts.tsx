'use client'

import { engagementLabel, type EngagementClass } from '@/lib/founder/engagement'
import type { EngagementCounts } from './types'

const ENGAGEMENT_ORDER: EngagementClass[] = [
  'highly_active',
  'active',
  're_engaged',
  'exploring',
  'onboarding',
  'new',
  'at_risk',
  'dormant',
]

const ENGAGEMENT_COLORS: Record<string, string> = {
  highly_active: '#16305d',
  active: '#3a5d96',
  re_engaged: '#D4AF37',
  exploring: '#8aa6cd',
  onboarding: '#b08d27',
  new: '#5b7fb1',
  at_risk: '#d97706',
  dormant: '#94a3b8',
  unknown: '#cbd5e1',
}

export function formatCount(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') return value.toLocaleString('en-ZA')
  return String(value)
}

export function engagementTone(value: string): string {
  if (value === 'highly_active' || value === 'active' || value === 're_engaged') {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
  }
  if (value === 'at_risk' || value === 'dormant') {
    return 'bg-amber-50 text-amber-900 ring-amber-200'
  }
  if (value === 'onboarding' || value === 'new') {
    return 'bg-brand-50 text-brand-800 ring-brand-200'
  }
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

export function EngagementBadge({ value }: { value: EngagementClass | string }) {
  const known = ENGAGEMENT_ORDER.includes(value as EngagementClass)
  const label = known ? engagementLabel(value as EngagementClass) : value || 'Unknown'
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${engagementTone(value)}`}
    >
      {label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === 'high'
      ? 'bg-amber-50 text-amber-900 ring-amber-200'
      : priority === 'medium'
        ? 'bg-brand-50 text-brand-800 ring-brand-200'
        : 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tone}`}
    >
      {priority || 'unknown'}
    </span>
  )
}

export function AudienceBadge({ audience }: { audience: string }) {
  const isAgent = audience === 'youth-agent' || audience === 'agent'
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        isAgent
          ? 'bg-accent-50 text-accent-900 ring-accent-200'
          : 'bg-brand-50 text-brand-800 ring-brand-200'
      }`}
    >
      {isAgent ? 'Youth Agent' : audience === 'sme' ? 'SME' : audience || 'Unknown'}
    </span>
  )
}

/** Lightweight SVG donut — no chart library */
export function DonutChart({
  segments,
  size = 148,
  thickness = 18,
  centerLabel,
  centerSub,
}: {
  segments: Array<{ key: string; label: string; value: number; color: string }>
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  if (total === 0) {
    return (
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={thickness}
          />
        </svg>
        <p className="absolute text-xs text-slate-400">No data</p>
      </div>
    )
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={thickness}
        />
        {segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const length = (s.value / total) * circumference
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += length
            return el
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerLabel != null && (
          <p className="text-xl font-bold tabular-nums text-brand-900">{centerLabel}</p>
        )}
        {centerSub && <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{centerSub}</p>}
      </div>
    </div>
  )
}

export function HorizontalBarList({
  rows,
  valueKey = 'value',
  labelKey = 'label',
  color = '#0F1E3D',
  secondaryColor,
  secondaryKey,
  max,
  emptyLabel = 'No data yet',
}: {
  rows: Array<Record<string, string | number | null | undefined>>
  valueKey?: string
  labelKey?: string
  color?: string
  secondaryColor?: string
  secondaryKey?: string
  max?: number
  emptyLabel?: string
}) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyLabel}</p>
  }

  const peak =
    max ??
    Math.max(
      1,
      ...rows.map((r) => {
        const a = Number(r[valueKey] || 0)
        const b = secondaryKey ? Number(r[secondaryKey] || 0) : 0
        return Math.max(a, b)
      })
    )

  return (
    <ul className="space-y-3">
      {rows.map((row, idx) => {
        const label = String(row[labelKey] ?? 'Unknown')
        const value = Number(row[valueKey] || 0)
        const secondary = secondaryKey ? Number(row[secondaryKey] || 0) : null
        const pct = Math.max(2, Math.round((value / peak) * 100))
        const secPct =
          secondary != null ? Math.max(secondary > 0 ? 2 : 0, Math.round((secondary / peak) * 100)) : null
        return (
          <li key={`${label}-${idx}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-slate-800">{label}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">
                {value.toLocaleString('en-ZA')}
                {secondary != null ? ` / ${secondary.toLocaleString('en-ZA')}` : ''}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: typeof row.color === 'string' ? row.color : color,
                }}
              />
            </div>
            {secPct != null && secondaryColor && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${secPct}%`, backgroundColor: secondaryColor }}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ComparisonBars({
  items,
}: {
  items: Array<{ label: string; sme: number; agent: number }>
}) {
  if (!items.length) {
    return <p className="py-6 text-center text-sm text-slate-500">No comparison data</p>
  }
  const peak = Math.max(1, ...items.flatMap((i) => [i.sme, i.agent]))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-brand-800" /> SME
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-accent-500" /> Youth Agent
        </span>
      </div>
      {items.map((item) => (
        <div key={item.label}>
          <p className="mb-1.5 text-sm font-medium text-slate-800">{item.label}</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-800 transition-all duration-500"
                  style={{ width: `${Math.max(item.sme > 0 ? 3 : 0, (item.sme / peak) * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs tabular-nums text-slate-600">
                {item.sme.toLocaleString('en-ZA')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-accent-500 transition-all duration-500"
                  style={{ width: `${Math.max(item.agent > 0 ? 3 : 0, (item.agent / peak) * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs tabular-nums text-slate-600">
                {item.agent.toLocaleString('en-ZA')}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProgressRing({
  value,
  label,
  size = 96,
}: {
  value: number | null | undefined
  label: string
  size?: number
}) {
  const pct = value == null ? null : Math.max(0, Math.min(100, value))
  const thickness = 10
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const dash = pct == null ? 0 : (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={thickness}
          />
          {pct != null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#D4AF37"
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold tabular-nums text-brand-900">
            {pct == null ? '—' : `${pct}%`}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-600">{label}</p>
    </div>
  )
}

export function engagementSegments(counts?: EngagementCounts) {
  const source = counts || {}
  return ENGAGEMENT_ORDER.map((key) => ({
    key,
    label: engagementLabel(key),
    value: Number(source[key] || 0),
    color: ENGAGEMENT_COLORS[key] || ENGAGEMENT_COLORS.unknown,
  })).filter((s) => s.value > 0)
}

export { ENGAGEMENT_COLORS, ENGAGEMENT_ORDER }
