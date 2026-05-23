import { NextRequest, NextResponse } from 'next/server';
import { googleMapsService } from '@/lib/services/googleMaps';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'geocode':
        const address = searchParams.get('address');
        if (!address) {
          return NextResponse.json({
            success: false,
            message: 'Address parameter is required'
          }, { status: 400 });
        }

        const location = await googleMapsService.geocodeAddress(address);
        return NextResponse.json({
          success: true,
          data: location,
          message: 'Address geocoded successfully'
        });

      case 'reverse-geocode':
        const lat = parseFloat(searchParams.get('lat') || '0');
        const lng = parseFloat(searchParams.get('lng') || '0');
        
        if (lat === 0 && lng === 0) {
          return NextResponse.json({
            success: false,
            message: 'Latitude and longitude parameters are required'
          }, { status: 400 });
        }

        const address_result = await googleMapsService.reverseGeocode(lat, lng);
        return NextResponse.json({
          success: true,
          data: { address: address_result },
          message: 'Reverse geocoding completed successfully'
        });

      case 'search-places':
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json({
            success: false,
            message: 'Query parameter is required'
          }, { status: 400 });
        }

        const lat_param = searchParams.get('lat');
        const lng_param = searchParams.get('lng');
        const radius = parseInt(searchParams.get('radius') || '50000');

        let location_param = undefined;
        if (lat_param && lng_param) {
          location_param = {
            lat: parseFloat(lat_param),
            lng: parseFloat(lng_param)
          };
        }

        const places = await googleMapsService.searchPlaces(query, location_param, radius);
        return NextResponse.json({
          success: true,
          data: places,
          message: 'Places search completed successfully'
        });

      case 'place-details':
        const placeId = searchParams.get('place_id');
        if (!placeId) {
          return NextResponse.json({
            success: false,
            message: 'Place ID parameter is required'
          }, { status: 400 });
        }

        const placeDetails = await googleMapsService.getPlaceDetails(placeId);
        return NextResponse.json({
          success: true,
          data: placeDetails,
          message: 'Place details retrieved successfully'
        });

      case 'nearby-places':
        const nearby_lat = parseFloat(searchParams.get('lat') || '0');
        const nearby_lng = parseFloat(searchParams.get('lng') || '0');
        const type = searchParams.get('type') || 'establishment';
        const nearby_radius = parseInt(searchParams.get('radius') || '5000');

        if (nearby_lat === 0 && nearby_lng === 0) {
          return NextResponse.json({
            success: false,
            message: 'Latitude and longitude parameters are required'
          }, { status: 400 });
        }

        const nearbyPlaces = await googleMapsService.findNearbyPlaces(
          { lat: nearby_lat, lng: nearby_lng },
          type,
          nearby_radius
        );
        return NextResponse.json({
          success: true,
          data: nearbyPlaces,
          message: 'Nearby places found successfully'
        });

      case 'distance':
        const lat1 = parseFloat(searchParams.get('lat1') || '0');
        const lng1 = parseFloat(searchParams.get('lng1') || '0');
        const lat2 = parseFloat(searchParams.get('lat2') || '0');
        const lng2 = parseFloat(searchParams.get('lng2') || '0');

        if (lat1 === 0 && lng1 === 0 && lat2 === 0 && lng2 === 0) {
          return NextResponse.json({
            success: false,
            message: 'All coordinate parameters are required'
          }, { status: 400 });
        }

        const distance = googleMapsService.calculateDistance(
          { lat: lat1, lng: lng1 },
          { lat: lat2, lng: lng2 }
        );
        return NextResponse.json({
          success: true,
          data: { distance },
          message: 'Distance calculated successfully'
        });

      case 'status':
        const isConfigured = googleMapsService.isConfigured();
        return NextResponse.json({
          success: true,
          data: { 
            configured: isConfigured,
            hasApiKey: googleMapsService.getApiKey() !== ''
          },
          message: 'Google Maps service status retrieved'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified. Available actions: geocode, reverse-geocode, search-places, place-details, nearby-places, distance, status'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Google Maps API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the maps request'
    }, { status: 500 });
  }
}
