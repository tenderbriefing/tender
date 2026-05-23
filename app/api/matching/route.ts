import { NextRequest, NextResponse } from 'next/server';
import { connectorMatchingService, MatchingRequest } from '@/lib/services/connectorMatching';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'find-connectors':
        return await findConnectors(data);
      
      case 'notify-connectors':
        return await notifyConnectors(data);
      
      case 'process-responses':
        return await processResponses(data);
      
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Matching API error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function findConnectors(data: MatchingRequest) {
  try {
    const matches = await connectorMatchingService.findConnectorsInRadius(data);
    
    return NextResponse.json({
      success: true,
      data: {
        matches,
        totalFound: matches.length,
        maxDistance: data.maxDistance
      }
    });
  } catch (error: any) {
    throw new Error(`Failed to find connectors: ${error.message}`);
  }
}

async function notifyConnectors(data: { matches: any[], request: MatchingRequest }) {
  try {
    await connectorMatchingService.notifyConnectors(data.matches, data.request);
    
    return NextResponse.json({
      success: true,
      message: `Notifications sent to ${data.matches.length} connectors`
    });
  } catch (error: any) {
    throw new Error(`Failed to notify connectors: ${error.message}`);
  }
}

async function processResponses(data: { tenderId: string, responses: any[] }) {
  try {
    const selectedConnectorId = await connectorMatchingService.processConnectorResponses(
      data.tenderId,
      data.responses
    );
    
    return NextResponse.json({
      success: true,
      data: {
        selectedConnectorId,
        totalResponses: data.responses.length
      }
    });
  } catch (error: any) {
    throw new Error(`Failed to process responses: ${error.message}`);
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  switch (action) {
    case 'test-matching':
      return await testMatching();
    
    default:
      return NextResponse.json(
        { success: false, message: 'Invalid action' },
        { status: 400 }
      );
  }
}

async function testMatching() {
  try {
    // Test data for connector matching
    const testRequest: MatchingRequest = {
      tenderId: 'test-tender-123',
      tenderTitle: 'Test Tender Briefing',
      briefingDate: new Date('2024-02-15'),
      briefingTime: '10:00 AM',
      location: {
        address: '123 Main Street',
        city: 'Johannesburg',
        province: 'Gauteng'
      },
      requiredSkills: ['construction', 'engineering'],
      maxDistance: 30
    };

    const matches = await connectorMatchingService.findConnectorsInRadius(testRequest);
    
    return NextResponse.json({
      success: true,
      data: {
        testRequest,
        matches: matches.slice(0, 5), // Return top 5 matches
        totalFound: matches.length
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
