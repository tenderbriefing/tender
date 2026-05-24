'use client'

import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { useSmeWorkspaceActions } from '@/hooks/useSmeWorkspaceActions'
import {
  Bookmark,
  Building2,
  Copy,
  FileDown,
  MapPin,
  Star,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface TenderWorkspaceActionsProps {
  tender: TenderBriefing
}

function ActionButton({
  active,
  onClick,
  icon: Icon,
  label,
  activeLabel,
}: {
  active: boolean
  onClick: () => Promise<void>
  icon: typeof Star
  label: string
  activeLabel: string
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick().catch((err) =>
          toast.error(err instanceof Error ? err.message : 'Action failed')
        )
      }}
      className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold sm:flex-none ${
        active
          ? 'border-brand-600 bg-brand-50 text-brand-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {active ? activeLabel : label}
    </button>
  )
}

export default function TenderWorkspaceActions({ tender }: TenderWorkspaceActionsProps) {
  const workspace = useSmeWorkspaceActions(tender)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Tender link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Workspace Actions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Save, track, and follow procurement opportunities for your SME dashboard.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          active={workspace.isTracked}
          onClick={workspace.toggleTrack}
          icon={Star}
          label="Track Tender"
          activeLabel="Tracking"
        />
        <ActionButton
          active={workspace.isSaved}
          onClick={workspace.toggleSave}
          icon={Bookmark}
          label="Save Tender"
          activeLabel="Saved"
        />
        {tender.department && (
          <ActionButton
            active={workspace.isDepartmentWatched}
            onClick={workspace.toggleDepartment}
            icon={Building2}
            label="Follow Department"
            activeLabel="Following Dept"
          />
        )}
        {tender.province && (
          <ActionButton
            active={workspace.isProvinceWatched}
            onClick={workspace.toggleProvince}
            icon={MapPin}
            label="Follow Province"
            activeLabel="Following Province"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Copy className="h-4 w-4" aria-hidden />
          Copy link
        </button>
        <button
          type="button"
          disabled
          title="PDF export coming in a future release"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-400"
        >
          <FileDown className="h-4 w-4" aria-hidden />
          Export PDF (soon)
        </button>
      </div>
    </section>
  )
}
