import { environmentManager } from '@/lib/config/environment';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: Location;
  };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
}

interface GeocodingResult {
  results: Array<{
    formatted_address: string;
    geometry: {
      location: Location;
    };
    place_id: string;
    types: string[];
  }>;
  status: string;
}

interface PlacesResult {
  results: PlaceDetails[];
  status: string;
  next_page_token?: string;
}

interface DistanceMatrixResult {
  rows: Array<{
    elements: Array<{
      distance: {
        text: string;
        value: number; // in meters
      };
      duration: {
        text: string;
        value: number; // in seconds
      };
      status: string;
    }>;
  }>;
  status: string;
}

class GoogleMapsService {
  private apiKey: string = '';
  private baseUrl: string = 'https://maps.googleapis.com/maps/api';

  constructor() {
    this.initializeApiKey();
  }

  private async initializeApiKey() {
    try {
      const config = await environmentManager.loadConfig();
      this.apiKey = config.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY || '';
    } catch (error) {
      console.error('Failed to load Google Maps API key:', error);
      this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    }
  }

  async geocodeAddress(address: string): Promise<Location | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`
      );
      
      const data: GeocodingResult = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          address: result.formatted_address
        };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}`
      );
      
      const data: GeocodingResult = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
      
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }

  async searchPlaces(query: string, location?: Location, radius: number = 50000): Promise<PlaceDetails[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      let url = `${this.baseUrl}/place/textsearch/json?query=${encodeURIComponent(query)}&key=${this.apiKey}`;
      
      if (location) {
        url += `&location=${location.lat},${location.lng}&radius=${radius}`;
      }
      
      const response = await fetch(url);
      const data: PlacesResult = await response.json();
      
      if (data.status === 'OK') {
        return data.results;
      }
      
      return [];
    } catch (error) {
      console.error('Places search error:', error);
      throw error;
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/place/details/json?place_id=${placeId}&fields=place_id,name,formatted_address,geometry,types,rating,user_ratings_total&key=${this.apiKey}`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK') {
        return data.result;
      }
      
      return null;
    } catch (error) {
      console.error('Place details error:', error);
      throw error;
    }
  }

  async findNearbyPlaces(location: Location, type: string, radius: number = 5000): Promise<PlaceDetails[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&type=${type}&key=${this.apiKey}`
      );
      
      const data: PlacesResult = await response.json();
      
      if (data.status === 'OK') {
        return data.results;
      }
      
      return [];
    } catch (error) {
      console.error('Nearby places error:', error);
      throw error;
    }
  }

  calculateDistance(location1: Location, location2: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(location2.lat - location1.lat);
    const dLng = this.toRadians(location2.lng - location1.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(location1.lat)) * Math.cos(this.toRadians(location2.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async getDistanceMatrix(
    origins: Location[], 
    destinations: Location[], 
    mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
  ): Promise<DistanceMatrixResult | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const originsStr = origins.map(origin => `${origin.lat},${origin.lng}`).join('|');
      const destinationsStr = destinations.map(dest => `${dest.lat},${dest.lng}`).join('|');
      
      const response = await fetch(
        `${this.baseUrl}/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&mode=${mode}&key=${this.apiKey}`
      );
      
      const data: DistanceMatrixResult = await response.json();
      
      if (data.status === 'OK') {
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Distance matrix error:', error);
      throw error;
    }
  }

  async getDistanceAndDuration(
    origin: Location, 
    destination: Location, 
    mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
  ): Promise<{ distance: number; duration: number; distanceText: string; durationText: string } | null> {
    try {
      const result = await this.getDistanceMatrix([origin], [destination], mode);
      
      if (result && result.rows.length > 0 && result.rows[0].elements.length > 0) {
        const element = result.rows[0].elements[0];
        
        if (element.status === 'OK') {
          return {
            distance: element.distance.value, // in meters
            duration: element.duration.value, // in seconds
            distanceText: element.distance.text,
            durationText: element.duration.text
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting distance and duration:', error);
      return null;
    }
  }

  async findConnectorsWithinRadius(
    jobLocation: Location,
    connectorLocations: Array<{ connectorId: string; location: Location }>,
    maxRadiusKm: number = 30
  ): Promise<Array<{ connectorId: string; distance: number; duration: number }>> {
    try {
      const results: Array<{ connectorId: string; distance: number; duration: number }> = [];
      
      // Process connectors in batches to avoid API limits
      const batchSize = 10;
      for (let i = 0; i < connectorLocations.length; i += batchSize) {
        const batch = connectorLocations.slice(i, i + batchSize);
        const destinations = batch.map(connector => connector.location);
        
        const distanceMatrix = await this.getDistanceMatrix([jobLocation], destinations);
        
        if (distanceMatrix && distanceMatrix.rows.length > 0) {
          batch.forEach((connector, index) => {
            const element = distanceMatrix.rows[0].elements[index];
            
            if (element && element.status === 'OK') {
              const distanceKm = element.distance.value / 1000; // Convert meters to kilometers
              
              if (distanceKm <= maxRadiusKm) {
                results.push({
                  connectorId: connector.connectorId,
                  distance: distanceKm,
                  duration: element.duration.value
                });
              }
            }
          });
        }
        
        // Add delay between batches to respect API rate limits
        if (i + batchSize < connectorLocations.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Sort by distance (closest first)
      return results.sort((a, b) => a.distance - b.distance);
    } catch (error) {
      console.error('Error finding connectors within radius:', error);
      return [];
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== '';
  }
}

export const googleMapsService = new GoogleMapsService();
