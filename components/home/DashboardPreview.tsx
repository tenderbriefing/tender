'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Bell, Calendar, MapPin, FileText } from 'lucide-react'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { formatProcurementDateTime } from '@/lib/procurement/dates'

export default function DashboardPreview() {
  const [preview, setPreview] = useState<TenderBriefing | null>(null)

  useEffect(() => {
    fetch('/api/tender-briefings?compulsoryOnly=true')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length) {
          setPreview(json.data[0])
        }
      })
      .catch(() => {})
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className="relative mx-auto mt-16 max-w-5xl"
    >
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-brand-500" />
          <span className="ml-4 text-xs font-medium text-slate-500">
            Tender Opportunities — procurement table preview
          </span>
        </div>
        <div className="hidden sm:grid grid-cols-4 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
          <span>Tender Number</span>
          <span className="col-span-2">Description</span>
          <span>Closing Date</span>
        </div>
        {preview ? (
          <Link
            href={`/tenders/${preview.id}`}
            className="block px-4 py-4 hover:bg-brand-50/30 transition"
          >
            <div className="sm:grid sm:grid-cols-4 sm:gap-2 text-sm">
              <p className="font-mono text-xs font-bold text-slate-800">
                {preview.tenderNumber || '—'}
              </p>
              <p className="sm:col-span-2 font-medium text-brand-800 line-clamp-2">
                {preview.title}
              </p>
              <p className="text-slate-600">{preview.closingDate || 'TBC'}</p>
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {preview.briefingCompulsory ? 'Compulsory Briefing' : 'Briefing Session'} —{' '}
                  {preview.department}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatProcurementDateTime(preview.briefingDate, preview.briefingTime)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {preview.briefingVenue || preview.province || 'Venue TBC'}
                  </span>
                </p>
              </div>
              <span className="shrink-0 rounded border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
                COMPULSORY
              </span>
            </div>
          </Link>
        ) : (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
            <FileText className="h-4 w-4" />
            Loading live tender preview…
          </div>
        )}
        <div className="border-t border-slate-100 px-4 py-3 text-center">
          <Link href="/tenders" className="text-sm font-semibold text-brand-700 hover:underline">
            View all Tender Opportunities →
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
