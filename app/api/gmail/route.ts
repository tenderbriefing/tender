import { NextRequest, NextResponse } from 'next/server';
import { gmailService } from '@/lib/services/gmail';

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'send-email':
        const { to, cc, bcc, subject, text, html, attachments, replyTo } = data;
        if (!to || !subject || (!text && !html)) {
          return NextResponse.json({
            success: false,
            message: 'To, subject, and either text or html content are required'
          }, { status: 400 });
        }

        const sendResult = await gmailService.sendEmail({
          to,
          cc,
          bcc,
          subject,
          text,
          html,
          attachments,
          replyTo,
        });

        return NextResponse.json({
          success: sendResult,
          message: sendResult ? 'Email sent successfully' : 'Failed to send email'
        });

      case 'send-tender-notification':
        const { recipientEmail, tenderTitle, briefingDate, location, connectorName } = data;
        if (!recipientEmail || !tenderTitle || !briefingDate || !location) {
          return NextResponse.json({
            success: false,
            message: 'Recipient email, tender title, briefing date, and location are required'
          }, { status: 400 });
        }

        const notificationResult = await gmailService.sendTenderNotification(
          recipientEmail,
          tenderTitle,
          briefingDate,
          location,
          connectorName
        );

        return NextResponse.json({
          success: notificationResult,
          message: notificationResult ? 'Tender notification sent successfully' : 'Failed to send tender notification'
        });

      case 'send-briefing-reminder':
        const { reminderEmail, reminderTenderTitle, reminderBriefingDate, reminderLocation, hoursUntilBriefing } = data;
        if (!reminderEmail || !reminderTenderTitle || !reminderBriefingDate || !reminderLocation || hoursUntilBriefing === undefined) {
          return NextResponse.json({
            success: false,
            message: 'Email, tender title, briefing date, location, and hours until briefing are required'
          }, { status: 400 });
        }

        const reminderResult = await gmailService.sendBriefingReminder(
          reminderEmail,
          reminderTenderTitle,
          reminderBriefingDate,
          reminderLocation,
          hoursUntilBriefing
        );

        return NextResponse.json({
          success: reminderResult,
          message: reminderResult ? 'Briefing reminder sent successfully' : 'Failed to send briefing reminder'
        });

      case 'send-submission-confirmation':
        const { submissionEmail, submissionTenderTitle, submissionType, submissionDate } = data;
        if (!submissionEmail || !submissionTenderTitle || !submissionType || !submissionDate) {
          return NextResponse.json({
            success: false,
            message: 'Email, tender title, submission type, and submission date are required'
          }, { status: 400 });
        }

        const submissionResult = await gmailService.sendSubmissionConfirmation(
          submissionEmail,
          submissionTenderTitle,
          submissionType,
          submissionDate
        );

        return NextResponse.json({
          success: submissionResult,
          message: submissionResult ? 'Submission confirmation sent successfully' : 'Failed to send submission confirmation'
        });

      case 'send-welcome-email':
        const { welcomeEmail, userName, userType } = data;
        if (!welcomeEmail || !userName || !userType) {
          return NextResponse.json({
            success: false,
            message: 'Email, user name, and user type are required'
          }, { status: 400 });
        }

        if (!['entrepreneur', 'connector'].includes(userType)) {
          return NextResponse.json({
            success: false,
            message: 'User type must be either "entrepreneur" or "connector"'
          }, { status: 400 });
        }

        const welcomeResult = await gmailService.sendWelcomeEmail(
          welcomeEmail,
          userName,
          userType
        );

        return NextResponse.json({
          success: welcomeResult,
          message: welcomeResult ? 'Welcome email sent successfully' : 'Failed to send welcome email'
        });

      case 'send-payment-confirmation':
        const { paymentEmail, amount, serviceDescription, paymentDate } = data;
        if (!paymentEmail || amount === undefined || !serviceDescription || !paymentDate) {
          return NextResponse.json({
            success: false,
            message: 'Email, amount, service description, and payment date are required'
          }, { status: 400 });
        }

        const paymentResult = await gmailService.sendPaymentConfirmation(
          paymentEmail,
          amount,
          serviceDescription,
          paymentDate
        );

        return NextResponse.json({
          success: paymentResult,
          message: paymentResult ? 'Payment confirmation sent successfully' : 'Failed to send payment confirmation'
        });

      case 'mark-as-read':
        const { messageId } = data;
        if (!messageId) {
          return NextResponse.json({
            success: false,
            message: 'Message ID is required'
          }, { status: 400 });
        }

        const markReadResult = await gmailService.markAsRead(messageId);
        return NextResponse.json({
          success: markReadResult,
          message: markReadResult ? 'Message marked as read' : 'Failed to mark message as read'
        });

      case 'mark-as-unread':
        const { unreadMessageId } = data;
        if (!unreadMessageId) {
          return NextResponse.json({
            success: false,
            message: 'Message ID is required'
          }, { status: 400 });
        }

        const markUnreadResult = await gmailService.markAsUnread(unreadMessageId);
        return NextResponse.json({
          success: markUnreadResult,
          message: markUnreadResult ? 'Message marked as unread' : 'Failed to mark message as unread'
        });

      case 'delete-message':
        const { deleteMessageId } = data;
        if (!deleteMessageId) {
          return NextResponse.json({
            success: false,
            message: 'Message ID is required'
          }, { status: 400 });
        }

        const deleteResult = await gmailService.deleteMessage(deleteMessageId);
        return NextResponse.json({
          success: deleteResult,
          message: deleteResult ? 'Message deleted successfully' : 'Failed to delete message'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Gmail API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the Gmail request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'list-messages':
        const query = searchParams.get('query') || undefined;
        const maxResults = parseInt(searchParams.get('maxResults') || '10');
        const pageToken = searchParams.get('pageToken') || undefined;

        const messagesResult = await gmailService.getMessages(query, maxResults, pageToken);
        return NextResponse.json({
          success: true,
          data: messagesResult.messages,
          nextPageToken: messagesResult.nextPageToken,
          message: 'Messages listed successfully'
        });

      case 'search-messages':
        const searchQuery = searchParams.get('query');
        const searchMaxResults = parseInt(searchParams.get('maxResults') || '10');

        if (!searchQuery) {
          return NextResponse.json({
            success: false,
            message: 'Search query is required'
          }, { status: 400 });
        }

        const searchResults = await gmailService.searchMessages(searchQuery, searchMaxResults);
        return NextResponse.json({
          success: true,
          data: searchResults,
          message: 'Search completed successfully'
        });

      case 'get-message':
        const messageId = searchParams.get('messageId');
        if (!messageId) {
          return NextResponse.json({
            success: false,
            message: 'Message ID is required'
          }, { status: 400 });
        }

        const message = await gmailService.getMessage(messageId);
        return NextResponse.json({
          success: true,
          data: message,
          message: message ? 'Message retrieved successfully' : 'Message not found'
        });

      case 'get-labels':
        const labels = await gmailService.getLabels();
        return NextResponse.json({
          success: true,
          data: labels,
          message: 'Labels retrieved successfully'
        });

      case 'status':
        const isConfigured = gmailService.isConfigured();
        return NextResponse.json({
          success: true,
          data: {
            configured: isConfigured,
            projectId: 'tenderbriefing-472813'
          },
          message: 'Gmail service status retrieved'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified. Available actions: list-messages, search-messages, get-message, get-labels, status'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Gmail API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the Gmail request'
    }, { status: 500 });
  }
}
