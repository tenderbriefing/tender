import { google } from 'googleapis';
import { environmentManager } from '@/lib/config/environment';

interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  labels?: string[];
  snippet: string;
}

interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  replyTo?: string;
}

interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

class GmailService {
  private gmail: any;
  private auth: any;
  private projectId: string = 'tenderbriefing-472813';

  constructor() {
    this.initializeGmail();
  }

  private async initializeGmail() {
    try {
      const config = await environmentManager.loadConfig();
      
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: this.projectId,
          private_key: config.googleCalendarPrivateKey.replace(/\\n/g, '\n'),
          client_email: config.googleCalendarClientEmail,
        },
        scopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.compose'
        ]
      });

      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    } catch (error) {
      console.error('Failed to initialize Gmail:', error);
      throw error;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      const cc = options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : '';
      const bcc = options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : '';

      let emailBody = '';
      
      if (options.html) {
        emailBody = `
Content-Type: text/html; charset="UTF-8"
MIME-Version: 1.0
Content-Transfer-Encoding: 7bit
To: ${to}
${cc ? `Cc: ${cc}` : ''}
${bcc ? `Bcc: ${bcc}` : ''}
Subject: ${options.subject}
${options.replyTo ? `Reply-To: ${options.replyTo}` : ''}

${options.html}
        `.trim();
      } else {
        emailBody = `
Content-Type: text/plain; charset="UTF-8"
MIME-Version: 1.0
Content-Transfer-Encoding: 7bit
To: ${to}
${cc ? `Cc: ${cc}` : ''}
${bcc ? `Bcc: ${bcc}` : ''}
Subject: ${options.subject}
${options.replyTo ? `Reply-To: ${options.replyTo}` : ''}

${options.text || ''}
        `.trim();
      }

      // Handle attachments if provided
      if (options.attachments && options.attachments.length > 0) {
        const boundary = 'boundary_' + Math.random().toString(36).substr(2, 9);
        let multipartBody = `MIME-Version: 1.0
To: ${to}
${cc ? `Cc: ${cc}` : ''}
${bcc ? `Bcc: ${bcc}` : ''}
Subject: ${options.subject}
${options.replyTo ? `Reply-To: ${options.replyTo}` : ''}
Content-Type: multipart/mixed; boundary="${boundary}"

--${boundary}
Content-Type: ${options.html ? 'text/html' : 'text/plain'}; charset="UTF-8"
Content-Transfer-Encoding: 7bit

${options.html || options.text || ''}

`;

        for (const attachment of options.attachments) {
          const content = Buffer.isBuffer(attachment.content) 
            ? attachment.content.toString('base64')
            : Buffer.from(attachment.content).toString('base64');
          
          multipartBody += `--${boundary}
Content-Type: ${attachment.contentType || 'application/octet-stream'}
Content-Disposition: attachment; filename="${attachment.filename}"
Content-Transfer-Encoding: base64

${content}

`;
        }

        multipartBody += `--${boundary}--`;
        emailBody = multipartBody;
      }

      const encodedEmail = Buffer.from(emailBody).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      return !!response.data.id;
    } catch (error: any) {
      console.error('Send email error:', error);
      throw error;
    }
  }

  async getMessages(
    query?: string,
    maxResults: number = 10,
    pageToken?: string
  ): Promise<{ messages: EmailMessage[]; nextPageToken?: string }> {
    try {
      const params: any = {
        userId: 'me',
        maxResults,
      };

      if (query) {
        params.q = query;
      }

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await this.gmail.users.messages.list(params);
      const messages = response.data.messages || [];

      const detailedMessages: EmailMessage[] = [];
      for (const message of messages) {
        const messageDetails = await this.getMessage(message.id);
        if (messageDetails) {
          detailedMessages.push(messageDetails);
        }
      }

      return {
        messages: detailedMessages,
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error: any) {
      console.error('Get messages error:', error);
      throw error;
    }
  }

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload?.headers || [];
      
      const getHeader = (name: string): string => {
        const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : '';
      };

      const getBody = (payload: any): { text: string; html?: string } => {
        let text = '';
        let html = '';

        if (payload.body?.data) {
          text = Buffer.from(payload.body.data, 'base64').toString();
        }

        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              text = Buffer.from(part.body.data, 'base64').toString();
            } else if (part.mimeType === 'text/html' && part.body?.data) {
              html = Buffer.from(part.body.data, 'base64').toString();
            } else if (part.parts) {
              const subBody = getBody(part);
              if (subBody.text) text = subBody.text;
              if (subBody.html) html = subBody.html;
            }
          }
        }

        return { text, html };
      };

      const body = getBody(message.payload);
      const to = getHeader('to').split(',').map((email: string) => email.trim());
      const cc = getHeader('cc');
      const bcc = getHeader('bcc');

      return {
        id: message.id,
        threadId: message.threadId,
        subject: getHeader('subject'),
        from: getHeader('from'),
        to,
        cc: cc ? cc.split(',').map((email: string) => email.trim()) : undefined,
        bcc: bcc ? bcc.split(',').map((email: string) => email.trim()) : undefined,
        date: getHeader('date'),
        body: body.text,
        htmlBody: body.html,
        snippet: message.snippet || '',
        labels: message.labelIds || [],
      };
    } catch (error: any) {
      console.error('Get message error:', error);
      return null;
    }
  }

  async searchMessages(query: string, maxResults: number = 10): Promise<EmailMessage[]> {
    try {
      const result = await this.getMessages(query, maxResults);
      return result.messages;
    } catch (error: any) {
      console.error('Search messages error:', error);
      throw error;
    }
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
      return true;
    } catch (error: any) {
      console.error('Mark as read error:', error);
      return false;
    }
  }

  async markAsUnread(messageId: string): Promise<boolean> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['UNREAD'],
        },
      });
      return true;
    } catch (error: any) {
      console.error('Mark as unread error:', error);
      return false;
    }
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      await this.gmail.users.messages.delete({
        userId: 'me',
        id: messageId,
      });
      return true;
    } catch (error: any) {
      console.error('Delete message error:', error);
      return false;
    }
  }

  async getLabels(): Promise<Array<{ id: string; name: string; type: string }>> {
    try {
      const response = await this.gmail.users.labels.list({
        userId: 'me',
      });

      return response.data.labels.map((label: any) => ({
        id: label.id,
        name: label.name,
        type: label.type,
      }));
    } catch (error: any) {
      console.error('Get labels error:', error);
      throw error;
    }
  }

  // TenderConnect specific email templates and methods
  async sendTenderNotification(
    recipientEmail: string,
    tenderTitle: string,
    briefingDate: string,
    location: string,
    connectorName?: string
  ): Promise<boolean> {
    const template = this.getTenderNotificationTemplate(tenderTitle, briefingDate, location, connectorName);
    
    return this.sendEmail({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendBriefingReminder(
    recipientEmail: string,
    tenderTitle: string,
    briefingDate: string,
    location: string,
    hoursUntilBriefing: number
  ): Promise<boolean> {
    const template = this.getBriefingReminderTemplate(tenderTitle, briefingDate, location, hoursUntilBriefing);
    
    return this.sendEmail({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendSubmissionConfirmation(
    recipientEmail: string,
    tenderTitle: string,
    submissionType: string,
    submissionDate: string
  ): Promise<boolean> {
    const template = this.getSubmissionConfirmationTemplate(tenderTitle, submissionType, submissionDate);
    
    return this.sendEmail({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendWelcomeEmail(
    recipientEmail: string,
    userName: string,
    userType: 'entrepreneur' | 'connector'
  ): Promise<boolean> {
    const template = this.getWelcomeEmailTemplate(userName, userType);
    
    return this.sendEmail({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendPaymentConfirmation(
    recipientEmail: string,
    amount: number,
    serviceDescription: string,
    paymentDate: string
  ): Promise<boolean> {
    const template = this.getPaymentConfirmationTemplate(amount, serviceDescription, paymentDate);
    
    return this.sendEmail({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  private getTenderNotificationTemplate(
    tenderTitle: string,
    briefingDate: string,
    location: string,
    connectorName?: string
  ): EmailTemplate {
    const subject = `New Tender Briefing Assignment: ${tenderTitle}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">TenderConnect - New Briefing Assignment</h2>
        <p>Hello ${connectorName || 'Connector'},</p>
        <p>You have been assigned to attend a tender briefing:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${tenderTitle}</h3>
          <p><strong>Briefing Date:</strong> ${briefingDate}</p>
          <p><strong>Location:</strong> ${location}</p>
        </div>
        <p>Please log into your TenderConnect dashboard to view full details and prepare for the briefing.</p>
        <p>Best regards,<br>TenderConnect Team</p>
      </div>
    `;

    const text = `
TenderConnect - New Briefing Assignment

Hello ${connectorName || 'Connector'},

You have been assigned to attend a tender briefing:

${tenderTitle}
Briefing Date: ${briefingDate}
Location: ${location}

Please log into your TenderConnect dashboard to view full details and prepare for the briefing.

Best regards,
TenderConnect Team
    `;

    return { subject, html, text };
  }

  private getBriefingReminderTemplate(
    tenderTitle: string,
    briefingDate: string,
    location: string,
    hoursUntilBriefing: number
  ): EmailTemplate {
    const subject = `Reminder: Tender Briefing in ${hoursUntilBriefing} hours - ${tenderTitle}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">TenderConnect - Briefing Reminder</h2>
        <p>This is a reminder that you have a tender briefing coming up:</p>
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0;">${tenderTitle}</h3>
          <p><strong>Briefing Date:</strong> ${briefingDate}</p>
          <p><strong>Location:</strong> ${location}</p>
          <p><strong>Time Remaining:</strong> ${hoursUntilBriefing} hours</p>
        </div>
        <p>Please ensure you have all necessary documents and are prepared for the briefing.</p>
        <p>Best regards,<br>TenderConnect Team</p>
      </div>
    `;

    const text = `
TenderConnect - Briefing Reminder

This is a reminder that you have a tender briefing coming up:

${tenderTitle}
Briefing Date: ${briefingDate}
Location: ${location}
Time Remaining: ${hoursUntilBriefing} hours

Please ensure you have all necessary documents and are prepared for the briefing.

Best regards,
TenderConnect Team
    `;

    return { subject, html, text };
  }

  private getSubmissionConfirmationTemplate(
    tenderTitle: string,
    submissionType: string,
    submissionDate: string
  ): EmailTemplate {
    const subject = `Submission Confirmed: ${submissionType} for ${tenderTitle}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">TenderConnect - Submission Confirmed</h2>
        <p>Your submission has been successfully received:</p>
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0;">${tenderTitle}</h3>
          <p><strong>Submission Type:</strong> ${submissionType}</p>
          <p><strong>Submission Date:</strong> ${submissionDate}</p>
        </div>
        <p>Thank you for using TenderConnect. We will review your submission and get back to you soon.</p>
        <p>Best regards,<br>TenderConnect Team</p>
      </div>
    `;

    const text = `
TenderConnect - Submission Confirmed

Your submission has been successfully received:

${tenderTitle}
Submission Type: ${submissionType}
Submission Date: ${submissionDate}

Thank you for using TenderConnect. We will review your submission and get back to you soon.

Best regards,
TenderConnect Team
    `;

    return { subject, html, text };
  }

  private getWelcomeEmailTemplate(
    userName: string,
    userType: 'entrepreneur' | 'connector'
  ): EmailTemplate {
    const subject = `Welcome to TenderConnect, ${userName}!`;
    const userTypeText = userType === 'entrepreneur' ? 'Entrepreneur' : 'Connector';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to TenderConnect!</h2>
        <p>Hello ${userName},</p>
        <p>Welcome to TenderConnect! We're excited to have you join our platform as a ${userTypeText}.</p>
        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Getting Started</h3>
          <p>Here's what you can do next:</p>
          <ul>
            ${userType === 'entrepreneur' 
              ? '<li>Browse available tenders with compulsory briefings</li><li>Request connector services for tender briefings</li><li>Track your tender applications and progress</li>'
              : '<li>View available briefing assignments</li><li>Accept jobs that match your skills and location</li><li>Submit briefing notes and attendance proof</li>'
            }
          </ul>
        </div>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>TenderConnect Team</p>
      </div>
    `;

    const text = `
Welcome to TenderConnect!

Hello ${userName},

Welcome to TenderConnect! We're excited to have you join our platform as a ${userTypeText}.

Getting Started:
Here's what you can do next:

${userType === 'entrepreneur' 
  ? '- Browse available tenders with compulsory briefings\n- Request connector services for tender briefings\n- Track your tender applications and progress'
  : '- View available briefing assignments\n- Accept jobs that match your skills and location\n- Submit briefing notes and attendance proof'
}

If you have any questions, please don't hesitate to contact our support team.

Best regards,
TenderConnect Team
    `;

    return { subject, html, text };
  }

  private getPaymentConfirmationTemplate(
    amount: number,
    serviceDescription: string,
    paymentDate: string
  ): EmailTemplate {
    const subject = `Payment Confirmation - Compulsory Briefing Service`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">TenderConnect - Payment Confirmation</h2>
        <p>Your payment for compulsory tender briefing attendance has been successfully processed:</p>
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <p><strong>Service:</strong> Compulsory Tender Briefing Attendance</p>
          <p><strong>Amount:</strong> R250.00 (Fixed Rate)</p>
          <p><strong>Payment Date:</strong> ${paymentDate}</p>
          <p><strong>Service Includes:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Professional attendance at compulsory briefing</li>
            <li>Audio recording of the briefing</li>
            <li>Detailed summary notes</li>
            <li>Attendance proof documentation</li>
          </ul>
        </div>
        <p>Your connector will be assigned and will attend the briefing on your behalf. You will receive detailed notes and recordings after the briefing.</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Contact Information:</strong></p>
          <p style="margin: 5px 0;">📞 Landline: +27 10 013 3423</p>
          <p style="margin: 5px 0;">📱 WhatsApp: +27 61 5253 476</p>
          <p style="margin: 5px 0;">📍 Address: Maxwell Office Park, Magwa Crescent, Midrand, Gauteng</p>
        </div>
        <p>Best regards,<br>TenderConnect Team</p>
      </div>
    `;

    const text = `
TenderConnect - Payment Confirmation

Your payment for compulsory tender briefing attendance has been successfully processed:

Service: Compulsory Tender Briefing Attendance
Amount: R250.00 (Fixed Rate)
Payment Date: ${paymentDate}

Service Includes:
- Professional attendance at compulsory briefing
- Audio recording of the briefing
- Detailed summary notes
- Attendance proof documentation

Your connector will be assigned and will attend the briefing on your behalf. You will receive detailed notes and recordings after the briefing.

Contact Information:
📞 Landline: +27 10 013 3423
📱 WhatsApp: +27 61 5253 476
📍 Address: Maxwell Office Park, Magwa Crescent, Midrand, Gauteng

Best regards,
TenderConnect Team
    `;

    return { subject, html, text };
  }

  isConfigured(): boolean {
    return this.gmail !== null && this.auth !== null;
  }
}

export const gmailService = new GmailService();
