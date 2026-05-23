'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface SummaryStats {
  totalBriefings: number
  compulsoryBriefings: number
  provincesRepresented: string[]
  closingWithin7Days: number
}

export default function LiveProcurementStats() {
  const [stats, setStats] = useState<SummaryStats | null>(null)

  useEffect(() => {
    fetch('/api/tender-briefings/stats/summary')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStats(json.data)
      })
      .catch(() => {})
  }, [])

  if (!stats) return null

  const items = [
    { label: 'Active opportunities', value: stats.totalBriefings },
    { label: 'Compulsory briefings', value: stats.compulsoryBriefings },
    { label: 'Provinces covered', value: stats.provincesRepresented.length },
    { label: 'Closing within 7 days', value: stats.closingWithin7Days },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm"
        >
          <p className="text-2xl font-bold text-brand-700">{item.value}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">{item.label}</p>
        </div>
      ))}
      <p className="col-span-full text-center text-xs text-slate-500">
        Live counts from official procurement sync ·{' '}
        <Link href="/tenders" className="font-semibold text-brand-700 hover:underline">
          View Tender Opportunities
        </Link>
      </p>
    </motion.div>
  )
}
