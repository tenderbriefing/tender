import { NextRequest, NextResponse } from 'next/server'
import { automatedMatchingService } from '@/lib/services/automatedMatchingService'
import { connectorAvailabilityService } from '@/lib/services/connectorAvailabilityService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'respond':
        const { connectorId, bookingId, response, notes } = data
        
        if (!connectorId || !bookingId || !response) {
          return NextResponse.json({
            success: false,
            error: 'Missing required fields: connectorId, bookingId, response'
          }, { status: 400 })
        }

        if (!['accept', 'decline'].includes(response)) {
          return NextResponse.json({
            success: false,
            error: 'Invalid response. Must be "accept" or "decline"'
          }, { status: 400 })
        }

        const result = await automatedMatchingService.processConnectorResponse(
          connectorId,
          bookingId,
          response,
          notes
        )

        if (result) {
          return NextResponse.json({
            success: true,
            message: `Response ${response}ed successfully`
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to process response'
          }, { status: 500 })
        }

      case 'updateAvailability':
        const { userId, availability: availabilityData } = data
        
        if (!userId || !availabilityData) {
          return NextResponse.json({
            success: false,
            error: 'Missing required fields: userId, availability'
          }, { status: 400 })
        }

        const updateResult = await connectorAvailabilityService.setAvailability(
          userId,
          availabilityData
        )

        if (updateResult) {
          return NextResponse.json({
            success: true,
            message: 'Availability updated successfully'
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to update availability'
          }, { status: 500 })
        }

      case 'getAvailability':
        const { connectorId: getConnectorId } = data
        
        if (!getConnectorId) {
          return NextResponse.json({
            success: false,
            error: 'Missing required field: connectorId'
          }, { status: 400 })
        }

        const connectorAvailability = await connectorAvailabilityService.getAvailability(getConnectorId)
        
        if (connectorAvailability) {
          return NextResponse.json({
            success: true,
            availability: connectorAvailability
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Availability not found'
          }, { status: 404 })
        }

      case 'initializeAvailability':
        const { userProfile } = data
        
        if (!userProfile) {
          return NextResponse.json({
            success: false,
            error: 'Missing required field: userProfile'
          }, { status: 400 })
        }

        const initResult = await connectorAvailabilityService.initializeAvailability(userProfile)
        
        if (initResult) {
          return NextResponse.json({
            success: true,
            message: 'Availability initialized successfully'
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to initialize availability'
          }, { status: 500 })
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Connector response API error:', error)
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
    const connectorId = searchParams.get('connectorId')

    switch (action) {
      case 'getAvailability':
        if (!connectorId) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameter: connectorId'
          }, { status: 400 })
        }

        const connectorAvailability = await connectorAvailabilityService.getAvailability(connectorId)
        
        if (connectorAvailability) {
          return NextResponse.json({
            success: true,
            availability: connectorAvailability
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Availability not found'
          }, { status: 404 })
        }

      case 'getAvailableConnectors':
        const availableConnectors = await connectorAvailabilityService.getAvailableConnectors()
        
        return NextResponse.json({
          success: true,
          connectors: availableConnectors
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Connector response API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
