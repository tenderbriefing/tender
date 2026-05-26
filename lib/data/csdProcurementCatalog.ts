/**
 * CSD-style procurement categories and commodities for SME onboarding & matching.
 * Category = broad industry; Commodity = specific product/service.
 */

export interface ProcurementCategory {
  id: string
  name: string
  commodities: string[]
}

export const CSD_PROCUREMENT_CATEGORIES: ProcurementCategory[] = [
  {
    id: 'construction',
    name: 'Construction',
    commodities: [
      'Building Construction',
      'Civil Works',
      'Road Construction',
      'Plumbing',
      'Painting',
      'Roofing',
      'Paving',
      'Concrete Supply',
      'Plant Hire',
      'Renovations',
      'Maintenance Works',
      'Quantity Surveying',
      'Project Management',
    ],
  },
  {
    id: 'ict',
    name: 'ICT',
    commodities: [
      'Software Development',
      'Cybersecurity',
      'Networking',
      'Cloud Services',
      'IT Support',
      'Laptop Supply',
      'Printer Supply',
      'Website Development',
      'Mobile App Development',
      'Data Analytics',
      'Hardware Supply',
      'CCTV Systems',
      'Internet Connectivity',
      'Managed IT Services',
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    commodities: [
      'Poultry Farming',
      'Crop Production',
      'Livestock Farming',
      'Agricultural Inputs',
      'Fertilizer Supply',
      'Seeds Supply',
      'Irrigation Systems',
      'Farm Equipment',
      'Agro-processing',
      'Animal Feed',
      'Agricultural Training',
    ],
  },
  {
    id: 'security-services',
    name: 'Security Services',
    commodities: [
      'Guarding Services',
      'Armed Response',
      'Access Control',
      'CCTV Monitoring',
      'Alarm Systems',
      'Security Equipment',
      'Event Security',
      'Risk Assessments',
    ],
  },
  {
    id: 'cleaning-services',
    name: 'Cleaning Services',
    commodities: [
      'Office Cleaning',
      'Industrial Cleaning',
      'Deep Cleaning',
      'Hygiene Services',
      'Pest Control',
      'Waste Management',
      'Landscaping',
      'Sanitation Services',
    ],
  },
  {
    id: 'office-supplies',
    name: 'Office Supplies',
    commodities: [
      'Office Consumables',
      'Office Equipment',
      'Toners and Cartridges',
      'Paper Supply',
      'Filing Products',
      'Office Furniture',
      'Printers and Scanners',
    ],
  },
  {
    id: 'stationery',
    name: 'Stationery',
    commodities: [
      'School Stationery',
      'Corporate Stationery',
      'Printing Paper',
      'Pens and Writing Supplies',
      'Files and Folders',
      'Educational Materials',
    ],
  },
  {
    id: 'catering',
    name: 'Catering',
    commodities: [
      'Corporate Catering',
      'Event Catering',
      'School Nutrition',
      'Food Supply',
      'Beverage Supply',
      'Kitchen Equipment',
      'Hospitality Services',
    ],
  },
  {
    id: 'transport-logistics',
    name: 'Transport & Logistics',
    commodities: [
      'Goods Transport',
      'Courier Services',
      'Fleet Services',
      'Passenger Transport',
      'Warehousing',
      'Distribution',
      'Vehicle Hire',
      'Freight Services',
    ],
  },
  {
    id: 'electrical-services',
    name: 'Electrical Services',
    commodities: [
      'Electrical Installations',
      'Electrical Maintenance',
      'Solar Installations',
      'Backup Power',
      'Generator Supply',
      'Lighting Supply',
      'Electrical Compliance Certificates',
    ],
  },
  {
    id: 'civil-engineering',
    name: 'Civil Engineering',
    commodities: [
      'Structural Engineering',
      'Geotechnical Services',
      'Surveying',
      'Drainage Systems',
      'Bridge Works',
      'Earthworks',
      'Water Reticulation',
      'Road Rehabilitation',
    ],
  },
  {
    id: 'mechanical-services',
    name: 'Mechanical Services',
    commodities: [
      'HVAC Systems',
      'Boiler Maintenance',
      'Pump Systems',
      'Mechanical Installations',
      'Compressed Air Systems',
      'Lift Maintenance',
      'Industrial Maintenance',
    ],
  },
  {
    id: 'professional-services',
    name: 'Professional Services',
    commodities: [
      'Business Consulting',
      'Accounting Services',
      'Tax Services',
      'Legal Services',
      'HR Services',
      'Audit Services',
      'Research Services',
      'Monitoring and Evaluation',
    ],
  },
  {
    id: 'training-skills',
    name: 'Training & Skills Development',
    commodities: [
      'Accredited Training',
      'Occupational Training',
      'Learnerships',
      'Skills Programmes',
      'SDF Services',
      'Workplace Readiness',
      'Entrepreneurship Training',
      'Health and Safety Training',
      'Agriculture Training',
    ],
  },
  {
    id: 'printing-branding',
    name: 'Printing & Branding',
    commodities: [
      'Corporate Branding',
      'Promotional Items',
      'Large Format Printing',
      'Document Printing',
      'Signage',
      'Uniform Branding',
      'Graphic Design',
      'Packaging Design',
    ],
  },
  {
    id: 'events-management',
    name: 'Events Management',
    commodities: [
      'Conference Management',
      'Venue Hire',
      'Event Planning',
      'Audio Visual Hire',
      'Exhibition Services',
      'Corporate Events',
    ],
  },
  {
    id: 'furniture',
    name: 'Furniture',
    commodities: [
      'Office Furniture',
      'School Furniture',
      'Laboratory Furniture',
      'Furniture Supply',
      'Furniture Installation',
    ],
  },
  {
    id: 'medical-supplies',
    name: 'Medical Supplies',
    commodities: [
      'Medical Consumables',
      'Pharmaceutical Supply',
      'Diagnostic Equipment',
      'Hospital Equipment',
      'PPE Supply',
      'Medical Devices',
    ],
  },
  {
    id: 'water-sanitation',
    name: 'Water & Sanitation',
    commodities: [
      'Water Treatment',
      'Sewer Maintenance',
      'Water Tank Supply',
      'Borehole Services',
      'Sanitation Infrastructure',
      'Water Quality Testing',
    ],
  },
  {
    id: 'renewable-energy',
    name: 'Renewable Energy',
    commodities: [
      'Solar PV Systems',
      'Solar Water Heating',
      'Energy Audits',
      'Battery Storage',
      'Wind Energy',
      'Renewable Consulting',
    ],
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    commodities: [
      'Fabrication',
      'Production Services',
      'Industrial Machinery',
      'Assembly Services',
      'Quality Control',
      'Packaging Services',
    ],
  },
  {
    id: 'facilities-management',
    name: 'Facilities Management',
    commodities: [
      'Building Maintenance',
      'Property Management',
      'Utilities Management',
      'Helpdesk Services',
      'Space Planning',
    ],
  },
  {
    id: 'consulting-services',
    name: 'Consulting Services',
    commodities: [
      'Strategy Consulting',
      'Process Improvement',
      'Feasibility Studies',
      'Project Advisory',
      'Change Management',
    ],
  },
  {
    id: 'financial-services',
    name: 'Financial Services',
    commodities: [
      'Financial Advisory',
      'Payroll Services',
      'Insurance Brokerage',
      'Investment Advisory',
      'Grants Administration',
    ],
  },
  {
    id: 'legal-services',
    name: 'Legal Services',
    commodities: [
      'Contract Law',
      'Litigation Support',
      'Compliance Advisory',
      'Conveyancing',
      'Labour Law',
    ],
  },
  {
    id: 'marketing-communications',
    name: 'Marketing & Communications',
    commodities: [
      'Digital Marketing',
      'Public Relations',
      'Media Buying',
      'Content Creation',
      'Market Research',
      'Social Media Management',
    ],
  },
  {
    id: 'mining-industrial',
    name: 'Mining & Industrial Supplies',
    commodities: [
      'Mining Equipment',
      'Safety Equipment',
      'Industrial Consumables',
      'Lubricants Supply',
      'Conveyor Systems',
      'PPE Industrial',
    ],
  },
]

export function getCategoryByName(name: string): ProcurementCategory | undefined {
  return CSD_PROCUREMENT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  )
}

export function getCategoryById(id: string): ProcurementCategory | undefined {
  return CSD_PROCUREMENT_CATEGORIES.find((c) => c.id === id)
}

export function searchCatalog(query: string): {
  categories: ProcurementCategory[]
  commodityHits: Array<{ category: string; commodity: string }>
} {
  const q = query.trim().toLowerCase()
  if (!q) {
    return { categories: CSD_PROCUREMENT_CATEGORIES, commodityHits: [] }
  }

  const categories = CSD_PROCUREMENT_CATEGORIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.commodities.some((item) => item.toLowerCase().includes(q))
  )

  const commodityHits: Array<{ category: string; commodity: string }> = []
  for (const cat of CSD_PROCUREMENT_CATEGORIES) {
    for (const commodity of cat.commodities) {
      if (commodity.toLowerCase().includes(q)) {
        commodityHits.push({ category: cat.name, commodity })
      }
    }
  }

  return { categories, commodityHits }
}

/** Keywords for semantic / text matching (future AI). */
export function buildMatchingKeywords(categories: string[], commodities: string[]): string[] {
  const keywords = new Set<string>()
  for (const name of categories) {
    keywords.add(name.toLowerCase())
    const cat = getCategoryByName(name)
    cat?.commodities.forEach((c) => keywords.add(c.toLowerCase()))
  }
  for (const c of commodities) keywords.add(c.toLowerCase())
  return Array.from(keywords)
}
