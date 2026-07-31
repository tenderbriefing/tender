'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import {
  ArrowTopRightOnSquareIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { authFetch } from '@/lib/api/authenticatedFetch'
import {
  downloadIcsFile,
  type CalendarExportInput,
} from '@/lib/procurement/calendarLinks'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end?: Date
  time?: string
  location?: string
  type?: string
  tenderId?: string
  compulsory?: boolean
  href?: string
  requestId?: string
  googleCalendarUrl?: string | null
  exportTender?: CalendarExportInput
}

interface CalendarIntegrationProps {
  userType?: 'sme' | 'youth-agent' | 'admin'
  userEmail?: string
}

type ApiEvent = {
  id?: string
  title?: string
  summary?: string
  type?: string
  start?: string | { dateTime?: string; date?: string }
  end?: string | { dateTime?: string; date?: string }
  time?: string
  location?: string
  tenderId?: string
  compulsory?: boolean
  href?: string
  requestId?: string
  googleCalendarUrl?: string | null
  exportTender?: CalendarExportInput
}

function parseEventDate(value: ApiEvent['start']): Date | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const raw = value.dateTime || value.date
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function defaultHref(
  userType: CalendarIntegrationProps['userType'],
  tenderId?: string
): string {
  if (userType === 'youth-agent') return '/jobs'
  if (tenderId) return `/tenders/${tenderId}`
  return '/tenders'
}

function normalizeEvents(
  rows: ApiEvent[],
  userType: CalendarIntegrationProps['userType']
): CalendarEvent[] {
  const normalized: CalendarEvent[] = []
  rows.forEach((row, index) => {
    const start = parseEventDate(row.start)
    if (!start) return
    normalized.push({
      id: String(row.id || `${row.tenderId || 'event'}-${index}`),
      title: row.title || row.summary || 'Briefing',
      start,
      end: parseEventDate(row.end) || undefined,
      time: row.time,
      location: row.location,
      type: row.type,
      tenderId: row.tenderId,
      compulsory: row.compulsory,
      href: row.href || defaultHref(userType, row.tenderId),
      requestId: row.requestId,
      googleCalendarUrl: row.googleCalendarUrl,
      exportTender: row.exportTender,
    })
  })
  return normalized
}

function formatEventWhen(event: CalendarEvent) {
  if (event.time) {
    return `${format(event.start, 'EEE, d MMM yyyy')} · ${event.time}`
  }
  return format(event.start, 'EEE, d MMM yyyy · HH:mm')
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function EventActions({ event }: { event: CalendarEvent }) {
  const eventType = event.type === 'closing' ? 'closing' : 'briefing'
  const canExport = Boolean(event.exportTender) || Boolean(event.googleCalendarUrl)

  if (!canExport) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {event.googleCalendarUrl && (
        <a
          href={event.googleCalendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-brand-800 transition hover:border-brand-200 hover:bg-brand-50"
          onClick={(e) => e.stopPropagation()}
        >
          Google Calendar
        </a>
      )}
      {event.exportTender && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            downloadIcsFile(event.exportTender!, eventType)
          }}
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-brand-800 transition hover:border-brand-200 hover:bg-brand-50"
        >
          Apple / Outlook (.ics)
        </button>
      )}
    </div>
  )
}

function EventRow({
  event,
  onSelectDay,
}: {
  event: CalendarEvent
  onSelectDay?: (date: Date) => void
}) {
  const href = event.href || '#'
  return (
    <li
      className={`rounded-lg border p-3 ${
        event.type === 'closing'
          ? 'border-red-100 bg-red-50/60'
          : 'border-brand-100 bg-brand-50/50'
      }`}
    >
      <Link
        href={href}
        className="group block"
        onClick={() => onSelectDay?.(event.start)}
      >
        <p className="flex items-start justify-between gap-2 text-sm font-medium text-slate-900">
          <span className="group-hover:text-brand-800">{event.title}</span>
          <ArrowTopRightOnSquareIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
        </p>
        <p className="mt-1 flex items-center text-xs text-slate-600">
          <ClockIcon className="mr-1 h-3.5 w-3.5" />
          {formatEventWhen(event)}
        </p>
        {event.location && (
          <p className="mt-1 flex items-center text-xs text-slate-600">
            <MapPinIcon className="mr-1 h-3.5 w-3.5" />
            {event.location}
          </p>
        )}
        {event.compulsory && (
          <span className="mt-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Compulsory
          </span>
        )}
      </Link>
      <EventActions event={event} />
    </li>
  )
}

function EmptySchedule({
  userType,
  variant,
}: {
  userType: CalendarIntegrationProps['userType']
  variant: 'global' | 'day'
}) {
  const isAgent = userType === 'youth-agent'

  if (variant === 'day') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-slate-500">
        <CalendarIcon className="mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Nothing on this day</p>
        <p className="mt-1 text-xs text-slate-400">
          Pick another date, or use the actions below to grow your schedule.
        </p>
      </div>
    )
  }

  if (isAgent) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
        <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-800">
          No assignments on your schedule yet
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Claim a nearby job or open your assignments — accepted briefings appear here.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/jobs"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Claim nearby jobs
          </Link>
          <Link
            href="/jobs"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50"
          >
            View assignments
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
      <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-slate-400" />
      <p className="text-sm font-medium text-slate-800">
        Your briefing schedule is empty
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Save or track tenders, or request agent attendance — briefing and closing dates
        will show up here.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          href="/tenders?briefing=compulsory"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Browse compulsory briefings
        </Link>
        <Link
          href="/tenders"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50"
        >
          Save a tender
        </Link>
        <Link
          href="/sme/requests"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50"
        >
          Request agent attendance
        </Link>
      </div>
    </div>
  )
}

const CalendarIntegration = ({ userType, userEmail }: CalendarIntegrationProps) => {
  void userEmail
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const primary = await authFetch('/api/calendar/events')
      if (primary.ok) {
        const payload = await primary.json()
        if (payload.success && Array.isArray(payload.data)) {
          setEvents(normalizeEvents(payload.data as ApiEvent[], userType))
          return
        }
      }

      const startDate = startOfMonth(viewMonth)
      const endDate = endOfMonth(viewMonth)
      const fallback = await authFetch(
        `/api/calendar?action=events&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      )
      const fallbackPayload = await fallback.json().catch(() => null)
      if (fallback.ok && fallbackPayload?.success && Array.isArray(fallbackPayload.data)) {
        setEvents(normalizeEvents(fallbackPayload.data as ApiEvent[], userType))
        return
      }

      setEvents([])
      if (!primary.ok) {
        setError('Calendar data unavailable right now')
      }
    } catch (err) {
      setEvents([])
      setError(err instanceof Error ? err.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [userType, viewMonth])

  useEffect(() => {
    void fetchEvents()
    // Initial load only — month navigation filters client-side from the loaded set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    })
  }, [viewMonth])

  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = format(event.start, 'yyyy-MM-dd')
      const list = map.get(key) || []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd')
    return (eventsByDayKey.get(key) || []).sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    )
  }, [eventsByDayKey, selectedDate])

  const thisWeekEvents = useMemo(() => {
    const start = startOfDay(new Date())
    const end = addDays(start, 7)
    return events
      .filter((event) => event.start >= start && event.start < end)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [events])

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return events
      .filter((event) => event.start >= now || isSameDay(event.start, now))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5)
  }, [events])

  const scheduleHref = userType === 'youth-agent' ? '/jobs' : '/tenders'
  const scheduleLabel =
    userType === 'youth-agent' ? 'View assignments' : 'Browse tenders'
  const sectionTitle =
    userType === 'youth-agent' ? 'Your assignment schedule' : 'Your briefing schedule'
  const hasAnyEvents = events.length > 0

  const goToToday = () => {
    const today = new Date()
    setSelectedDate(today)
    setViewMonth(startOfMonth(today))
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center text-lg font-semibold text-slate-900">
            <CalendarIcon className="mr-2 h-5 w-5 text-brand-700" />
            {sectionTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {userType === 'youth-agent'
              ? 'Briefings from your accepted and available assignments.'
              : 'Briefings and closing dates from saved tenders and attendance requests.'}
          </p>
        </div>
        {error && (
          <p className="text-xs text-amber-700" role="status">
            {error}
          </p>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-lg bg-slate-100" />
          <div className="h-24 rounded-lg bg-slate-100" />
        </div>
      ) : !hasAnyEvents ? (
        <EmptySchedule userType={userType} variant="global" />
      ) : (
        <>
          {/* Mobile: This week list */}
          <div className="lg:hidden">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-slate-700">This week</h4>
              <button
                type="button"
                onClick={goToToday}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50"
              >
                Today
              </button>
            </div>
            {thisWeekEvents.length > 0 ? (
              <ul className="space-y-2">
                {thisWeekEvents.map((event) => (
                  <EventRow key={`week-${event.id}`} event={event} />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
                Nothing in the next 7 days. Upcoming items are listed below.
              </p>
            )}

            {upcomingEvents.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="mb-2 text-sm font-medium text-slate-700">Upcoming</h4>
                <ul className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <EventRow key={`m-up-${event.id}`} event={event} />
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Desktop: month grid + day panel */}
          <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => subMonths(m, 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                  aria-label="Previous month"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <h4 className="text-sm font-semibold text-slate-800">
                  {format(viewMonth, 'MMMM yyyy')}
                </h4>
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                  aria-label="Next month"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd')
                  const dayEvents = eventsByDayKey.get(key) || []
                  const inMonth = isSameMonth(day, viewMonth)
                  const selected = isSameDay(day, selectedDate)
                  const today = isToday(day)

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedDate(day)
                        if (!isSameMonth(day, viewMonth)) {
                          setViewMonth(startOfMonth(day))
                        }
                      }}
                      className={`relative flex min-h-[44px] flex-col items-center rounded-lg border px-1 py-1.5 text-sm transition ${
                        selected
                          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                          : today
                            ? 'border-brand-300 bg-brand-50 text-brand-900'
                            : inMonth
                              ? 'border-transparent text-slate-800 hover:border-slate-200 hover:bg-slate-50'
                              : 'border-transparent text-slate-400 hover:bg-slate-50'
                      }`}
                      aria-label={`${format(day, 'd MMMM yyyy')}${
                        dayEvents.length ? `, ${dayEvents.length} briefing(s)` : ''
                      }`}
                      aria-pressed={selected}
                    >
                      <span className="leading-none">{format(day, 'd')}</span>
                      {dayEvents.length > 0 && (
                        <span className="mt-1 flex items-center gap-0.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <span
                              key={event.id}
                              className={`h-1.5 w-1.5 rounded-full ${
                                selected
                                  ? 'bg-white'
                                  : event.type === 'closing'
                                    ? 'bg-red-500'
                                    : 'bg-brand-600'
                              }`}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                  Briefing
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Closing
                </span>
              </div>
            </div>

            <div className="flex min-h-[280px] flex-col">
              <h4 className="mb-3 text-sm font-medium text-slate-700">
                {format(selectedDate, 'EEEE, d MMMM')}
              </h4>

              {selectedDayEvents.length > 0 ? (
                <ul className="space-y-2 overflow-y-auto">
                  {selectedDayEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              ) : (
                <EmptySchedule userType={userType} variant="day" />
              )}

              <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="mb-2 text-sm font-medium text-slate-700">Upcoming</h4>
                {upcomingEvents.length > 0 ? (
                  <ul className="space-y-2">
                    {upcomingEvents.map((event) => (
                      <EventRow
                        key={`up-${event.id}`}
                        event={event}
                        onSelectDay={(date) => {
                          setSelectedDate(date)
                          setViewMonth(startOfMonth(date))
                        }}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No upcoming dates on your schedule</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Link
          href={scheduleHref}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          {scheduleLabel}
        </Link>
        {hasAnyEvents && (
          <button
            type="button"
            onClick={goToToday}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50"
          >
            Today
          </button>
        )}
      </div>
    </div>
  )
}

export default CalendarIntegration
