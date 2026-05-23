const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
]

const PROVINCE_ALIASES = {
  ec: 'Eastern Cape',
  'eastern cape': 'Eastern Cape',
  fs: 'Free State',
  'free state': 'Free State',
  gp: 'Gauteng',
  gauteng: 'Gauteng',
  kzn: 'KwaZulu-Natal',
  'kwazulu-natal': 'KwaZulu-Natal',
  'kwazulu natal': 'KwaZulu-Natal',
  lp: 'Limpopo',
  limpopo: 'Limpopo',
  mp: 'Mpumalanga',
  mpumalanga: 'Mpumalanga',
  nc: 'Northern Cape',
  'northern cape': 'Northern Cape',
  nw: 'North West',
  'north west': 'North West',
  wc: 'Western Cape',
  'western cape': 'Western Cape',
}

const CITY_HINTS = {
  johannesburg: 'Gauteng',
  sandton: 'Gauteng',
  pretoria: 'Gauteng',
  midrand: 'Gauteng',
  centurion: 'Gauteng',
  soweto: 'Gauteng',
  durban: 'KwaZulu-Natal',
  pietermaritzburg: 'KwaZulu-Natal',
  'cape town': 'Western Cape',
  bellville: 'Western Cape',
  stellenbosch: 'Western Cape',
  bloemfontein: 'Free State',
  polokwane: 'Limpopo',
  nelspruit: 'Mpumalanga',
  mbombela: 'Mpumalanga',
  kimberley: 'Northern Cape',
  mahikeng: 'North West',
  rustenburg: 'North West',
  'port elizabeth': 'Eastern Cape',
  gqeberha: 'Eastern Cape',
  'east london': 'Eastern Cape',
}

function normalizeProvince(value) {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'n/a') return ''

  const lower = trimmed.toLowerCase()
  if (PROVINCE_ALIASES[lower]) return PROVINCE_ALIASES[lower]

  const exact = SA_PROVINCES.find((p) => p.toLowerCase() === lower)
  if (exact) return exact

  for (const province of SA_PROVINCES) {
    if (lower.includes(province.toLowerCase())) return province
  }

  return trimmed
}

function detectProvinceFromText(text) {
  if (!text) return { province: '', confidence: 0 }

  const lower = text.toLowerCase()

  for (const [city, province] of Object.entries(CITY_HINTS)) {
    if (lower.includes(city)) {
      return { province, confidence: 0.75 }
    }
  }

  for (const province of SA_PROVINCES) {
    if (lower.includes(province.toLowerCase())) {
      return { province, confidence: 0.9 }
    }
  }

  for (const [alias, province] of Object.entries(PROVINCE_ALIASES)) {
    if (lower.includes(alias)) {
      return { province, confidence: 0.7 }
    }
  }

  return { province: '', confidence: 0 }
}

function enrichProvince(tender) {
  const normalized = normalizeProvince(tender.province)
  if (normalized && SA_PROVINCES.includes(normalized)) {
    return { ...tender, province: normalized }
  }

  const searchText = [
    tender.briefingVenue,
    tender.description,
    tender.deliveryLocation,
    tender.location,
    tender.title,
  ]
    .filter(Boolean)
    .join(' ')

  const detected = detectProvinceFromText(searchText)
  if (detected.province) {
    return {
      ...tender,
      province: detected.province,
      provinceConfidence: detected.confidence,
    }
  }

  return { ...tender, province: normalized || tender.province || '' }
}

module.exports = {
  SA_PROVINCES,
  normalizeProvince,
  detectProvinceFromText,
  enrichProvince,
}
