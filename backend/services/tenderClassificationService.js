const SECTORS = [
  'Construction',
  'ICT',
  'Security',
  'Cleaning',
  'Consulting',
  'Agriculture',
  'Electrical',
  'Civil Engineering',
  'Training',
  'Transport',
  'Maintenance',
  'General Goods and Services',
]

const SECTOR_KEYWORDS = {
  Construction: [
    'construction',
    'building',
    'renovation',
    'roof',
    'structural',
    'civil works',
    'brick',
    'plaster',
  ],
  ICT: [
    'ict',
    'software',
    'hardware',
    'network',
    'computer',
    'it ',
    'information technology',
    'cyber',
    'server',
    'cloud',
  ],
  Security: [
    'security',
    'guarding',
    'cctv',
    'alarm',
    'access control',
    'surveillance',
  ],
  Cleaning: ['cleaning', 'hygiene', 'janitorial', 'sanitation', 'waste removal'],
  Consulting: [
    'consulting',
    'consultancy',
    'advisory',
    'professional services',
    'feasibility',
  ],
  Agriculture: [
    'agriculture',
    'agricultural',
    'farming',
    'livestock',
    'crop',
    'arc-',
  ],
  Electrical: [
    'electrical',
    'electrical engineering',
    'wiring',
    'substation',
    'transformer',
    'power',
  ],
  'Civil Engineering': [
    'civil engineering',
    'roads',
    'bridges',
    'water reticulation',
    'sewer',
    'infrastructure',
  ],
  Training: [
    'training',
    'workshop',
    'capacity building',
    'skills development',
    'learnership',
  ],
  Transport: [
    'transport',
    'logistics',
    'fleet',
    'vehicle',
    'courier',
    'freight',
  ],
  Maintenance: [
    'maintenance',
    'repair',
    'servicing',
    'refurbishment',
    'inspection',
  ],
}

function classifyTender(tender) {
  const text = [
    tender.title,
    tender.description,
    tender.category,
    tender.procurementMethod,
    tender.department,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let bestSector = 'General Goods and Services'
  let bestScore = 0

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      bestSector = sector
    }
  }

  const confidence =
    bestScore === 0 ? 0.35 : Math.min(0.95, 0.45 + bestScore * 0.12)

  return {
    ...tender,
    industrySector: bestSector,
    industryConfidence: Math.round(confidence * 100) / 100,
  }
}

module.exports = {
  SECTORS,
  classifyTender,
}
