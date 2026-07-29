'use client'

import { FormEvent, useState } from 'react'
import { CheckCircle2, Loader2, MessageSquare } from 'lucide-react'

const CATEGORIES = [
  { value: 'general', label: 'General enquiry' },
  { value: 'payment', label: 'Payment / billing' },
  { value: 'account', label: 'Account / sign-in' },
  { value: 'agent', label: 'Youth Agent' },
  { value: 'attendance', label: 'Briefing attendance' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'other', label: 'Other' },
] as const

const ACK_COPY =
  'Thank you — we have received your enquiry. You will receive a response within 24 hours.'

export default function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('general')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ ticketId: string; email: string } | null>(null)

  const reset = () => {
    setName('')
    setEmail('')
    setSubject('')
    setCategory('general')
    setMessage('')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          category,
          message: message.trim(),
          source: 'contact',
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Unable to submit your enquiry. Please try again.')
      }

      setSuccess({
        ticketId: json.data?.id || 'received',
        email: email.trim(),
      })
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit your enquiry.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div
        className="rounded-2xl border border-brand-100 bg-white p-8 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 text-brand-800">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="text-lg font-semibold text-brand-900">Enquiry received</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{ACK_COPY}</p>
            <p className="mt-3 text-sm text-slate-600">
              We will reply to <span className="font-medium text-slate-900">{success.email}</span>
              {success.ticketId !== 'received' ? (
                <>
                  {' '}
                  · Ref <span className="font-mono text-xs">{success.ticketId}</span>
                </>
              ) : null}
              .
            </p>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="mt-6 text-sm font-semibold text-brand-800 hover:text-accent-600"
            >
              Send another message
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      noValidate
    >
      <div className="mb-4 flex items-center gap-2 text-brand-700">
        <MessageSquare className="h-5 w-5" aria-hidden />
        <span className="font-semibold">Send a message</span>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="contact-name" className="form-label">
            Full name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="contact-email" className="form-label">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="contact-category" className="form-label">
            Category
          </label>
          <select
            id="contact-category"
            name="category"
            className="form-input"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as (typeof CATEGORIES)[number]['value'])
            }
            disabled={submitting}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contact-subject" className="form-label">
            Subject
          </label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            className="form-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            placeholder="How can we help?"
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="contact-message" className="form-label">
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={4}
            className="form-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={10}
            disabled={submitting}
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            'Submit enquiry'
          )}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        You will receive a response within 24 hours.
      </p>
    </form>
  )
}
