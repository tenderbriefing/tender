import { NextRequest, NextResponse } from 'next/server';
import { googleCalendarService, BriefingEvent } from '@/lib/calendar/googleCalendar';

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'create-briefing':
        const briefingEvent = await googleCalendarService.createBriefingEvent(data as BriefingEvent);
        return NextResponse.json({
          success: true,
          data: briefingEvent,
          message: 'Briefing event created successfully'
        });

      case 'update-briefing':
        const { eventId, ...briefingData } = data;
        const updatedEvent = await googleCalendarService.updateBriefingEvent(eventId, briefingData as BriefingEvent);
        return NextResponse.json({
          success: true,
          data: updatedEvent,
          message: 'Briefing event updated successfully'
        });

      case 'delete-briefing':
        await googleCalendarService.deleteBriefingEvent(data.eventId);
        return NextResponse.json({
          success: true,
          message: 'Briefing event deleted successfully'
        });

      case 'check-availability':
        const { connectorEmail, startTime, endTime } = data;
        const isAvailable = await googleCalendarService.checkAvailability(
          connectorEmail,
          new Date(startTime),
          new Date(endTime)
        );
        return NextResponse.json({
          success: true,
          data: { available: isAvailable },
          message: 'Availability checked successfully'
        });

      case 'get-events':
        const { startDate, endDate } = data;
        const events = await googleCalendarService.getEvents(
          new Date(startDate),
          new Date(endDate)
        );
        return NextResponse.json({
          success: true,
          data: events,
          message: 'Events retrieved successfully'
        });

      case 'send-reminder':
        const { eventId: reminderEventId, message } = data;
        await googleCalendarService.sendBriefingReminder(reminderEventId, message);
        return NextResponse.json({
          success: true,
          message: 'Reminder sent successfully'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the calendar request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'events':
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        
        if (!startDate || !endDate) {
          return NextResponse.json({
            success: false,
            message: 'Start date and end date are required'
          }, { status: 400 });
        }

        const events = await googleCalendarService.getEvents(
          new Date(startDate),
          new Date(endDate)
        );
        
        return NextResponse.json({
          success: true,
          data: events,
          message: 'Events retrieved successfully'
        });

      case 'availability':
        const connectorEmail = searchParams.get('connectorEmail');
        const startTime = searchParams.get('startTime');
        const endTime = searchParams.get('endTime');
        
        if (!connectorEmail || !startTime || !endTime) {
          return NextResponse.json({
            success: false,
            message: 'Connector email, start time, and end time are required'
          }, { status: 400 });
        }

        const isAvailable = await googleCalendarService.checkAvailability(
          connectorEmail,
          new Date(startTime),
          new Date(endTime)
        );
        
        return NextResponse.json({
          success: true,
          data: { available: isAvailable },
          message: 'Availability checked successfully'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the calendar request'
    }, { status: 500 });
  }
}
