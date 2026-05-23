import { db } from '@/lib/database'
import { doc, setDoc, getDoc, updateDoc, collection, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore'
import { gmailService } from './gmail'

export interface Notification {
  id: string
  userId: string
  type: 'job_opportunity' | 'job_assigned' | 'job_completed' | 'payment_received' | 'system_update' | 'booking_cancelled'
  title: string
  message: string
  data?: {
    bookingId?: string
    tenderId?: string
    amount?: number
    connectorId?: string
    entrepreneurId?: string
    [key: string]: any
  }
  read: boolean
  createdAt: Date
  expiresAt?: Date
  priority: 'low' | 'medium' | 'high' | 'urgent'
  channels: ('in_app' | 'email' | 'sms')[]
  sentChannels: ('in_app' | 'email' | 'sms')[]
}

export interface NotificationTemplate {
  type: Notification['type']
  title: string
  message: string
  emailSubject?: string
  emailTemplate?: string
  priority: Notification['priority']
  channels: Notification['channels']
}

class NotificationService {
  private templates: NotificationTemplate[] = [
    {
      type: 'job_opportunity',
      title: 'New Job Opportunity Available',
      message: 'A new tender briefing job is available in your area. Click to view details and apply.',
      emailSubject: 'New Job Opportunity - TenderConnect',
      emailTemplate: 'job_opportunity',
      priority: 'high',
      channels: ['in_app', 'email']
    },
    {
      type: 'job_assigned',
      title: 'Job Assigned Successfully',
      message: 'You have been assigned to attend a tender briefing. Check your jobs page for details.',
      emailSubject: 'Job Assigned - TenderConnect',
      emailTemplate: 'job_assigned',
      priority: 'high',
      channels: ['in_app', 'email']
    },
    {
      type: 'job_completed',
      title: 'Job Completed Successfully',
      message: 'Your work has been reviewed and approved. Payment will be processed within 24 hours.',
      emailSubject: 'Job Completed - Payment Processing',
      emailTemplate: 'job_completed',
      priority: 'medium',
      channels: ['in_app', 'email']
    },
    {
      type: 'payment_received',
      title: 'Payment Received',
      message: 'Your payment of R{amount} has been processed and is now available in your account.',
      emailSubject: 'Payment Received - TenderConnect',
      emailTemplate: 'payment_received',
      priority: 'medium',
      channels: ['in_app', 'email']
    },
    {
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: 'A booking you were assigned to has been cancelled. You will not be penalized.',
      emailSubject: 'Booking Cancelled - TenderConnect',
      emailTemplate: 'booking_cancelled',
      priority: 'medium',
      channels: ['in_app', 'email']
    },
    {
      type: 'system_update',
      title: 'System Update',
      message: 'TenderConnect has been updated with new features and improvements.',
      emailSubject: 'TenderConnect System Update',
      emailTemplate: 'system_update',
      priority: 'low',
      channels: ['in_app', 'email']
    }
  ]

  /**
   * Send a notification to a user
   */
  async sendNotification(
    userId: string,
    type: Notification['type'],
    data?: Notification['data'],
    customMessage?: string
  ): Promise<boolean> {
    try {
      const template = this.templates.find(t => t.type === type)
      if (!template) {
        console.error('Notification template not found for type:', type)
        return false
      }

      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Process message with data
      let message = customMessage || template.message
      if (data) {
        Object.keys(data).forEach(key => {
          const placeholder = `{${key}}`
          message = message.replace(new RegExp(placeholder, 'g'), String(data[key]))
        })
      }

      const notification: Notification = {
        id: notificationId,
        userId,
        type,
        title: template.title,
        message,
        data,
        read: false,
        createdAt: new Date(),
        priority: template.priority,
        channels: template.channels,
        sentChannels: []
      }

      // Save notification to database
      await setDoc(doc(db, 'notifications', notificationId), {
        ...notification,
        createdAt: serverTimestamp()
      })

      // Send through configured channels
      await this.sendThroughChannels(notification, template)

      return true
    } catch (error) {
      console.error('Error sending notification:', error)
      return false
    }
  }

  /**
   * Send notification through configured channels
   */
  private async sendThroughChannels(
    notification: Notification, 
    template: NotificationTemplate
  ): Promise<void> {
    const sentChannels: Notification['sentChannels'] = []

    for (const channel of template.channels) {
      try {
        switch (channel) {
          case 'in_app':
            // Already saved to database
            sentChannels.push('in_app')
            break

          case 'email':
            await this.sendEmailNotification(notification, template)
            sentChannels.push('email')
            break

          case 'sms':
            // TODO: Implement SMS service
            console.log('SMS notification not implemented yet')
            break
        }
      } catch (error) {
        console.error(`Error sending notification through ${channel}:`, error)
      }
    }

    // Update notification with sent channels
    await updateDoc(doc(db, 'notifications', notification.id), {
      sentChannels
    })
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: Notification,
    template: NotificationTemplate
  ): Promise<void> {
    try {
      // Get user email
      const userDoc = await getDoc(doc(db, 'users', notification.userId))
      if (!userDoc.exists()) {
        throw new Error('User not found')
      }

      const userData = userDoc.data()
      const userEmail = userData.email

      if (!userEmail) {
        throw new Error('User email not found')
      }

      // Generate email content
      const emailSubject = template.emailSubject || notification.title
      const emailBody = this.generateEmailBody(notification, template)

      // Send email using Gmail service
      await gmailService.sendEmail({
        to: userEmail,
        subject: emailSubject,
        html: emailBody,
        text: notification.message
      })

    } catch (error) {
      console.error('Error sending email notification:', error)
      throw error
    }
  }

  /**
   * Generate email body for notification
   */
  private generateEmailBody(notification: Notification, template: NotificationTemplate): string {
    const baseTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">TenderConnect</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; margin-top: 0;">${notification.title}</h2>
          
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
            ${notification.message}
          </p>
          
          ${this.getEmailActionButton(notification)}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              This is an automated message from TenderConnect. Please do not reply to this email.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">
              If you have any questions, contact us at support@tenderconnect.com
            </p>
          </div>
        </div>
      </div>
    `

    return baseTemplate
  }

  /**
   * Get action button for email based on notification type
   */
  private getEmailActionButton(notification: Notification): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tenderconnect.com'
    
    switch (notification.type) {
      case 'job_opportunity':
        return `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/jobs" 
               style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              View Available Jobs
            </a>
          </div>
        `
      
      case 'job_assigned':
        return `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/jobs" 
               style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              View Job Details
            </a>
          </div>
        `
      
      case 'payment_received':
        return `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/jobs" 
               style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              View Earnings
            </a>
          </div>
        `
      
      default:
        return `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/dashboard" 
               style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
        `
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string, 
    limit: number = 50,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    try {
      let q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      )

      if (unreadOnly) {
        q = query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          where('read', '==', false),
          orderBy('createdAt', 'desc')
        )
      }

      const querySnapshot = await getDocs(q)
      const notifications: Notification[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        notifications.push({
          id: doc.id,
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data,
          read: data.read,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate(),
          priority: data.priority,
          channels: data.channels,
          sentChannels: data.sentChannels
        })
      })

      return notifications.slice(0, limit)
    } catch (error) {
      console.error('Error getting user notifications:', error)
      return []
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      })
      return true
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const notifications = await this.getUserNotifications(userId, 1000, true)
      
      const updatePromises = notifications.map(notification =>
        updateDoc(doc(db, 'notifications', notification.id), {
          read: true
        })
      )

      await Promise.all(updatePromises)
      return true
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const unreadNotifications = await this.getUserNotifications(userId, 1000, true)
      return unreadNotifications.length
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  /**
   * Send job opportunity notifications to multiple connectors
   */
  async notifyConnectorsOfJobOpportunity(
    connectorIds: string[],
    bookingData: {
      bookingId: string
      tenderId: string
      tenderTitle: string
      organization: string
      location: string
      briefingDate: Date
      briefingTime: string
      briefingVenue: string
      amount: number
    }
  ): Promise<boolean> {
    try {
      const notificationPromises = connectorIds.map(connectorId =>
        this.sendNotification(connectorId, 'job_opportunity', {
          bookingId: bookingData.bookingId,
          tenderId: bookingData.tenderId,
          tenderTitle: bookingData.tenderTitle,
          organization: bookingData.organization,
          location: bookingData.location,
          briefingDate: bookingData.briefingDate.toISOString(),
          briefingTime: bookingData.briefingTime,
          briefingVenue: bookingData.briefingVenue,
          amount: bookingData.amount
        })
      )

      await Promise.all(notificationPromises)
      return true
    } catch (error) {
      console.error('Error notifying connectors of job opportunity:', error)
      return false
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      // This would typically be run as a scheduled job
      // For now, we'll just return 0 as we don't have expiration logic implemented
      return 0
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error)
      return 0
    }
  }
}

export const notificationService = new NotificationService()
