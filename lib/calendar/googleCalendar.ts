import { google } from 'googleapis';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export interface BriefingEvent {
  tenderId: string;
  tenderTitle: string;
  organization: string;
  location: string;
  briefingDate: Date;
  briefingTime: string;
  connectorEmail: string;
  connectorName: string;
  entrepreneurEmail: string;
  entrepreneurName: string;
}

class GoogleCalendarService {
  private calendar: any;
  private calendarId: string;

  constructor() {
    this.calendarId = 'primary'; // Use primary calendar, or specify a specific calendar ID
    
    // Initialize Google Calendar API
    this.initializeCalendar();
  }

  private initializeCalendar() {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: process.env.GOOGLE_CALENDAR_PROJECT_ID,
          private_key: process.env.GOOGLE_CALENDAR_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
        },
        scopes: ['https://www.googleapis.com/auth/calendar']
      });

      this.calendar = google.calendar({ version: 'v3', auth });
    } catch (error) {
      console.error('Failed to initialize Google Calendar:', error);
      throw new Error('Google Calendar initialization failed');
    }
  }

  /**
   * Create a tender briefing event
   */
  async createBriefingEvent(briefing: BriefingEvent): Promise<CalendarEvent> {
    try {
      const event: CalendarEvent = {
        summary: `Tender Briefing: ${briefing.tenderTitle}`,
        description: `
Tender Briefing Details:
- Tender: ${briefing.tenderTitle}
- Organization: ${briefing.organization}
- Location: ${briefing.location}
- Connector: ${briefing.connectorName}
- Entrepreneur: ${briefing.entrepreneurName}

Please ensure you arrive 15 minutes early for the briefing.
        `.trim(),
        start: {
          dateTime: this.formatDateTime(briefing.briefingDate, briefing.briefingTime),
          timeZone: 'Africa/Johannesburg'
        },
        end: {
          dateTime: this.formatDateTime(briefing.briefingDate, briefing.briefingTime, 2), // 2 hours duration
          timeZone: 'Africa/Johannesburg'
        },
        attendees: [
          {
            email: briefing.connectorEmail,
            displayName: briefing.connectorName,
            responseStatus: 'needsAction'
          },
          {
            email: briefing.entrepreneurEmail,
            displayName: briefing.entrepreneurName,
            responseStatus: 'needsAction'
          }
        ],
        location: briefing.location,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 }, // 1 hour before
            { method: 'popup', minutes: 15 } // 15 minutes before
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: event
      });

      return response.data;
    } catch (error) {
      console.error('Failed to create briefing event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update a tender briefing event
   */
  async updateBriefingEvent(eventId: string, briefing: BriefingEvent): Promise<CalendarEvent> {
    try {
      const event: CalendarEvent = {
        summary: `Tender Briefing: ${briefing.tenderTitle}`,
        description: `
Tender Briefing Details:
- Tender: ${briefing.tenderTitle}
- Organization: ${briefing.organization}
- Location: ${briefing.location}
- Connector: ${briefing.connectorName}
- Entrepreneur: ${briefing.entrepreneurName}

Please ensure you arrive 15 minutes early for the briefing.
        `.trim(),
        start: {
          dateTime: this.formatDateTime(briefing.briefingDate, briefing.briefingTime),
          timeZone: 'Africa/Johannesburg'
        },
        end: {
          dateTime: this.formatDateTime(briefing.briefingDate, briefing.briefingTime, 2),
          timeZone: 'Africa/Johannesburg'
        },
        attendees: [
          {
            email: briefing.connectorEmail,
            displayName: briefing.connectorName,
            responseStatus: 'needsAction'
          },
          {
            email: briefing.entrepreneurEmail,
            displayName: briefing.entrepreneurName,
            responseStatus: 'needsAction'
          }
        ],
        location: briefing.location,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 15 }
          ]
        }
      };

      const response = await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventId,
        resource: event
      });

      return response.data;
    } catch (error) {
      console.error('Failed to update briefing event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete a tender briefing event
   */
  async deleteBriefingEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId
      });
    } catch (error) {
      console.error('Failed to delete briefing event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Get events for a specific date range
   */
  async getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Failed to get events:', error);
      throw new Error('Failed to retrieve calendar events');
    }
  }

  /**
   * Check connector availability for a specific time
   */
  async checkAvailability(connectorEmail: string, startTime: Date, endTime: Date): Promise<boolean> {
    try {
      const response = await this.calendar.freebusy.query({
        resource: {
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          items: [{ id: connectorEmail }]
        }
      });

      const busyTimes = response.data.calendars[connectorEmail]?.busy || [];
      return busyTimes.length === 0;
    } catch (error) {
      console.error('Failed to check availability:', error);
      return false; // Assume available if check fails
    }
  }

  /**
   * Format date and time for Google Calendar
   */
  private formatDateTime(date: Date, time: string, addHours: number = 0): string {
    const [hours, minutes] = time.split(':').map(Number);
    const eventDate = new Date(date);
    eventDate.setHours(hours + addHours, minutes, 0, 0);
    return eventDate.toISOString();
  }

  /**
   * Send briefing reminder
   */
  async sendBriefingReminder(eventId: string, message: string): Promise<void> {
    try {
      // This would typically integrate with an email service
      // For now, we'll just log the reminder
      console.log(`Reminder for event ${eventId}: ${message}`);
      
      // In a real implementation, you might:
      // 1. Send email via SendGrid, AWS SES, etc.
      // 2. Send SMS via Twilio
      // 3. Send push notification
    } catch (error) {
      console.error('Failed to send reminder:', error);
      throw new Error('Failed to send briefing reminder');
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
