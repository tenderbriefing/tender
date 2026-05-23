const { env, hasEnv, checkRequired, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = ['GOOGLE_MAPS_API_KEY']
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const DISTANCE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'
const DEFAULT_AGENT_RADIUS_KM = 50

function getConfig() {
  return checkRequired(REQUIRED_ENV)
}

function getStatus() {
  const config = getConfig()
  return integrationResult({
    id: 'maps',
    name: 'Google Maps Platform',
    status: statusFromConfig(config.configured),
    requiredEnv: REQUIRED_ENV,
    missing: config.missing,
    setupNotes:
      'Enable Geocoding and Distance Matrix APIs. Used for Youth Agent matching within 50km.',
  })
}

function getApiKey() {
  return env('GOOGLE_MAPS_API_KEY')
}

async function geocodeAddress(address) {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'GOOGLE_MAPS_API_KEY not configured' }
  }

  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`
  const response = await fetch(url)
  const data = await response.json()

  if (data.status !== 'OK' || !data.results?.[0]) {
    return { ok: false, error: data.status || 'Geocoding failed' }
  }

  const result = data.results[0]
  return {
    ok: true,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
  }
}

/**
 * Haversine distance in km (fallback when Distance Matrix unavailable).
 */
function haversineKm(origin, destination) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(destination.lat - origin.lat)
  const dLng = toRad(destination.lng - origin.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) *
      Math.cos(toRad(destination.lat)) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function calculateDistance(origin, destination, options = {}) {
  const apiKey = getApiKey()
  const maxKm = options.maxKm ?? DEFAULT_AGENT_RADIUS_KM

  if (!origin?.lat || !destination?.lat) {
    return { ok: false, error: 'Origin and destination coordinates required' }
  }

  if (!apiKey) {
    const km = haversineKm(origin, destination)
    return {
      ok: true,
      km,
      meters: Math.round(km * 1000),
      withinAgentRadius: km <= maxKm,
      method: 'haversine_fallback',
    }
  }

  const url =
    `${DISTANCE_URL}?origins=${origin.lat},${origin.lng}` +
    `&destinations=${destination.lat},${destination.lng}&key=${apiKey}`

  try {
    const response = await fetch(url)
    const data = await response.json()
    const element = data.rows?.[0]?.elements?.[0]

    if (element?.status === 'OK') {
      const meters = element.distance.value
      const km = meters / 1000
      return {
        ok: true,
        km,
        meters,
        durationSeconds: element.duration?.value,
        withinAgentRadius: km <= maxKm,
        method: 'distance_matrix',
      }
    }
  } catch {
    /* fall through */
  }

  const km = haversineKm(origin, destination)
  return {
    ok: true,
    km,
    meters: Math.round(km * 1000),
    withinAgentRadius: km <= maxKm,
    method: 'haversine_fallback',
  }
}

function isWithinAgentRadius(origin, destination, maxKm = DEFAULT_AGENT_RADIUS_KM) {
  const km = haversineKm(origin, destination)
  return { withinRadius: km <= maxKm, km }
}

async function healthCheck() {
  return getStatus()
}

module.exports = {
  REQUIRED_ENV,
  DEFAULT_AGENT_RADIUS_KM,
  getConfig,
  getStatus,
  geocodeAddress,
  calculateDistance,
  isWithinAgentRadius,
  healthCheck,
}
