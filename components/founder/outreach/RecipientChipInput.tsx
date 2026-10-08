'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import {
  isValidEmailSyntax,
  normaliseEmail,
  splitRecipientTokens,
} from '@/lib/founder/outreach/parseRecipients'

type Props = {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Other fields' addresses for cross-field dedupe hints */
  reserved?: string[]
}

export function RecipientChipInput({
  label,
  values,
  onChange,
  placeholder = 'Paste addresses…',
  reserved = [],
}: Props) {
  const [draft, setDraft] = useState('')
  const reservedSet = useMemo(() => new Set(reserved.map(normaliseEmail)), [reserved])

  function commitTokens(raw: string) {
    const tokens = splitRecipientTokens(raw)
    if (!tokens.length) return
    const next = [...values]
    for (const token of tokens) {
      const email = normaliseEmail(token)
      if (!email) continue
      if (next.some((v) => normaliseEmail(v) === email)) continue
      if (reservedSet.has(email)) continue
      next.push(email)
    }
    onChange(next)
    setDraft('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') {
      if (draft.trim()) {
        e.preventDefault()
        commitTokens(draft)
      }
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        {values.map((email) => {
          const valid = isValidEmailSyntax(email)
          return (
            <span
              key={email}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                valid
                  ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-100'
                  : 'bg-red-50 text-red-800 ring-1 ring-red-200'
              }`}
            >
              {email}
              <button
                type="button"
                aria-label={`Remove ${email}`}
                className="ml-0.5 text-slate-400 hover:text-slate-700"
                onClick={() => onChange(values.filter((v) => v !== email))}
              >
                ×
              </button>
            </span>
          )
        })}
        <input
          className="min-w-[140px] flex-1 border-0 bg-transparent py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          value={draft}
          placeholder={values.length ? '' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) commitTokens(draft)
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (text && /[\s,;]/.test(text)) {
              e.preventDefault()
              commitTokens(`${draft} ${text}`)
            }
          }}
        />
      </div>
    </div>
  )
}
