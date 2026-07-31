import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService, BriefingEvent } from '@/lib/calendar/googleCalendar'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'
import type { VerifiedApiUser } from '@/lib/auth/verifyApiUser'

function scopedConnectorEmail(
  access: VerifiedApiUser,
  requested: string | null | undefined
): { email: string } | { error: Response } {
  const requestedEmail = typeof requested === 'string' ? requested.trim() : ''
  if (access.userType === 'admin') {
    if (!requestedEmail) {
      return {
        error: NextResponse.json(
          { success: false, message: 'connectorEmail is required' },
          { status: 400 }
        ),
      }
    }
    return { email: requestedEmail }
  }

  const callerEmail = access.email?.trim()
  if (!callerEmail) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Authenticated user has no email for calendar scope' },
        { status: 403 }
      ),
    }
  }

  if (requestedEmail && requestedEmail.toLowerCase() !== callerEmail.toLowerCase()) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Forbidden — connectorEmail must match the signed-in user' },
        { status: 403 }
      ),
    }
  }

  return { email: callerEmail }
}

export async function POST(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access

  try {
    const { action, ...data } = await request.json()

    switch (action) {
      case 'create-briefing': {
        const scoped = scopedConnectorEmail(access, data.connectorEmail)
        if ('error' in scoped) return scoped.error
        const briefingEvent = await googleCalendarService.createBriefingEvent({
          ...(data as BriefingEvent),
          connectorEmail: scoped.email,
        })
        return NextResponse.json({
          success: true,
          data: briefingEvent,
          message: 'Briefing event created successfully',
        })
      }

      case 'update-briefing': {
        const { eventId, ...briefingData } = data
        const scoped = scopedConnectorEmail(access, briefingData.connectorEmail)
        if ('error' in scoped) return scoped.error
        const updatedEvent = await googleCalendarService.updateBriefingEvent(eventId, {
          ...(briefingData as BriefingEvent),
          connectorEmail: scoped.email,
        })
        return NextResponse.json({
          success: true,
          data: updatedEvent,
          message: 'Briefing event updated successfully',
        })
      }

      case 'delete-briefing':
        await googleCalendarService.deleteBriefingEvent(data.eventId)
        return NextResponse.json({
          success: true,
          message: 'Briefing event deleted successfully',
        })

      case 'check-availability': {
        const { startTime, endTime } = data
        const scoped = scopedConnectorEmail(access, data.connectorEmail)
        if ('error' in scoped) return scoped.error
        const isAvailable = await googleCalendarService.checkAvailability(
          scoped.email,
          new Date(startTime),
          new Date(endTime)
        )
        return NextResponse.json({
          success: true,
          data: { available: isAvailable },
          message: 'Availability checked successfully',
        })
      }

      case 'get-events': {
        const { startDate, endDate } = data
        const events = await googleCalendarService.getEvents(
          new Date(startDate),
          new Date(endDate)
        )
        return NextResponse.json({
          success: true,
          data: events,
          message: 'Events retrieved successfully',
        })
      }

      case 'send-reminder': {
        if (access.userType !== 'admin') {
          return NextResponse.json(
            { success: false, message: 'Forbidden — admin only' },
            { status: 403 }
          )
        }
        const { eventId: reminderEventId, message } = data
        await googleCalendarService.sendBriefingReminder(reminderEventId, message)
        return NextResponse.json({
          success: true,
          message: 'Reminder sent successfully',
        })
      }

      default:
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid action specified',
          },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    console.error('Calendar API error:', error)
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'An error occurred while processing the calendar request',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'events': {
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        if (!startDate || !endDate) {
          return NextResponse.json(
            {
              success: false,
              message: 'Start date and end date are required',
            },
            { status: 400 }
          )
        }

        const events = await googleCalendarService.getEvents(
          new Date(startDate),
          new Date(endDate)
        )

        return NextResponse.json({
          success: true,
          data: events,
          message: 'Events retrieved successfully',
        })
      }

      case 'availability': {
        const startTime = searchParams.get('startTime')
        const endTime = searchParams.get('endTime')

        if (!startTime || !endTime) {
          return NextResponse.json(
            {
              success: false,
              message: 'Start time and end time are required',
            },
            { status: 400 }
          )
        }

        const scoped = scopedConnectorEmail(access, searchParams.get('connectorEmail'))
        if ('error' in scoped) return scoped.error

        const isAvailable = await googleCalendarService.checkAvailability(
          scoped.email,
          new Date(startTime),
          new Date(endTime)
        )

        return NextResponse.json({
          success: true,
          data: { available: isAvailable },
          message: 'Availability checked successfully',
        })
      }

      default:
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid action specified',
          },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    console.error('Calendar API error:', error)
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'An error occurred while processing the calendar request',
      },
      { status: 500 }
    )
  }
}
