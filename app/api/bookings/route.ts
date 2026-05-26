import { NextRequest, NextResponse } from 'next/server'
import { bookingService, BookingRequest } from '@/lib/services/bookingService'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'

export async function POST(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access

  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'create':
        if (data.smeId && data.smeId !== access.uid && access.userType !== 'admin') {
          return NextResponse.json(
            { success: false, error: 'Forbidden' },
            { status: 403 }
          )
        }
        const bookingRequest: BookingRequest = {
          tenderId: data.tenderId,
          smeId: data.smeId || access.uid,
          amount: 250.00 // Fixed rate
        }
        
        const result = await bookingService.createBooking(bookingRequest)
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            booking: result.booking
          })
        } else {
          return NextResponse.json({
            success: false,
            error: result.error
          }, { status: 400 })
        }

      case 'get':
        const booking = await bookingService.getBookingById(data.bookingId)
        if (booking) {
          return NextResponse.json({
            success: true,
            booking
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Booking not found'
          }, { status: 404 })
        }

      case 'getByEntrepreneur':
        const entrepreneurBookings = await bookingService.getBookingsByEntrepreneur(data.smeId)
        return NextResponse.json({
          success: true,
          bookings: entrepreneurBookings
        })

      case 'getByConnector':
        const connectorBookings = await bookingService.getBookingsByConnector(data.connectorId)
        return NextResponse.json({
          success: true,
          bookings: connectorBookings
        })

      case 'updateStatus':
        const statusUpdated = await bookingService.updateBookingStatus(
          data.bookingId,
          data.status,
          data.connectorId,
          data.connectorName
        )
        
        if (statusUpdated) {
          return NextResponse.json({
            success: true,
            message: 'Booking status updated successfully'
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to update booking status'
          }, { status: 500 })
        }

      case 'submitWork':
        const workSubmitted = await bookingService.submitWork(
          data.bookingId,
          {
            attendanceProof: data.attendanceProof,
            audioRecording: data.audioRecording,
            summaryNotes: data.summaryNotes,
            notes: data.notes
          }
        )
        
        if (workSubmitted) {
          return NextResponse.json({
            success: true,
            message: 'Work submitted successfully'
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to submit work'
          }, { status: 500 })
        }

      case 'cancel':
        const cancelled = await bookingService.cancelBooking(data.bookingId, data.reason)
        
        if (cancelled) {
          return NextResponse.json({
            success: true,
            message: 'Booking cancelled successfully'
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to cancel booking'
          }, { status: 500 })
        }

      case 'getStats':
        if (data.userType === 'entrepreneur') {
          const stats = await bookingService.getBookingStats(data.userId)
          return NextResponse.json({
            success: true,
            stats
          })
        } else if (data.userType === 'connector') {
          const stats = await bookingService.getJobStats(data.userId)
          return NextResponse.json({
            success: true,
            stats
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Invalid user type'
          }, { status: 400 })
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Booking API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')
    const userType = searchParams.get('userType')
    const bookingId = searchParams.get('bookingId')

    switch (action) {
      case 'get':
        if (!bookingId) {
          return NextResponse.json({
            success: false,
            error: 'Booking ID is required'
          }, { status: 400 })
        }
        
        const booking = await bookingService.getBookingById(bookingId)
        if (booking) {
          return NextResponse.json({
            success: true,
            booking
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Booking not found'
          }, { status: 404 })
        }

      case 'getByUser':
        if (!userId || !userType) {
          return NextResponse.json({
            success: false,
            error: 'User ID and type are required'
          }, { status: 400 })
        }
        
        let bookings
        if (userType === 'entrepreneur') {
          bookings = await bookingService.getBookingsByEntrepreneur(userId)
        } else if (userType === 'connector') {
          bookings = await bookingService.getBookingsByConnector(userId)
        } else {
          return NextResponse.json({
            success: false,
            error: 'Invalid user type'
          }, { status: 400 })
        }
        
        return NextResponse.json({
          success: true,
          bookings
        })

      case 'getStats':
        if (!userId || !userType) {
          return NextResponse.json({
            success: false,
            error: 'User ID and type are required'
          }, { status: 400 })
        }
        
        let stats
        if (userType === 'entrepreneur') {
          stats = await bookingService.getBookingStats(userId)
        } else if (userType === 'connector') {
          stats = await bookingService.getJobStats(userId)
        } else {
          return NextResponse.json({
            success: false,
            error: 'Invalid user type'
          }, { status: 400 })
        }
        
        return NextResponse.json({
          success: true,
          stats
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Booking API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
