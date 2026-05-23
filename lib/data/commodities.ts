// Comprehensive list of categories for South African government tenders
// Based on real eTenders.gov.za categories and CIDB classifications

export interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  examples: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'construction',
    name: 'Construction & Infrastructure',
    description: 'Building construction, civil engineering, and infrastructure development',
    keywords: ['construction', 'building', 'infrastructure', 'civil', 'engineering', 'road', 'bridge', 'water', 'sewer'],
    examples: ['Building Construction', 'Road Construction', 'Water Systems', 'Electrical Installations', 'HVAC Systems']
  },
  {
    id: 'technology',
    name: 'Information Technology',
    description: 'Software development, hardware procurement, and IT services',
    keywords: ['software', 'hardware', 'computer', 'IT', 'technology', 'digital', 'telecommunications', 'network'],
    examples: ['Software Development', 'Hardware Procurement', 'IT Support', 'Network Infrastructure', 'Database Systems']
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Medical',
    description: 'Medical equipment, pharmaceuticals, and healthcare services',
    keywords: ['medical', 'health', 'healthcare', 'pharmaceutical', 'hospital', 'clinic', 'medicine', 'equipment'],
    examples: ['Medical Equipment', 'Pharmaceuticals', 'Healthcare Services', 'Diagnostic Equipment', 'Medical Supplies']
  },
  {
    id: 'education',
    name: 'Education & Training',
    description: 'Educational materials, training services, and educational technology',
    keywords: ['education', 'training', 'learning', 'school', 'university', 'curriculum', 'teaching', 'student'],
    examples: ['Educational Materials', 'Training Services', 'Educational Technology', 'Professional Development', 'Skills Training']
  },
  {
    id: 'transportation',
    name: 'Transportation & Logistics',
    description: 'Vehicle procurement, transport services, and logistics',
    keywords: ['transport', 'vehicle', 'logistics', 'shipping', 'freight', 'delivery', 'fleet', 'aviation'],
    examples: ['Vehicle Procurement', 'Transport Services', 'Fleet Management', 'Logistics', 'Fuel Supplies']
  },
  {
    id: 'energy',
    name: 'Energy & Utilities',
    description: 'Power generation, energy equipment, and utility services',
    keywords: ['energy', 'power', 'electricity', 'renewable', 'solar', 'wind', 'utility', 'generation'],
    examples: ['Energy Equipment', 'Power Generation', 'Renewable Energy', 'Utility Services', 'Energy Storage']
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Food',
    description: 'Agricultural equipment, food supplies, and farming services',
    keywords: ['agriculture', 'farming', 'food', 'livestock', 'crop', 'irrigation', 'fertilizer', 'catering'],
    examples: ['Agricultural Equipment', 'Food Supplies', 'Farming Machinery', 'Irrigation Systems', 'Catering Services']
  },
  {
    id: 'services',
    name: 'Professional Services',
    description: 'Consulting, legal services, accounting, and professional expertise',
    keywords: ['consulting', 'legal', 'accounting', 'audit', 'advisory', 'management', 'financial', 'professional'],
    examples: ['Consulting Services', 'Legal Services', 'Accounting Services', 'Management Consulting', 'Financial Services']
  },
  {
    id: 'security',
    name: 'Security & Safety',
    description: 'Security services, safety equipment, and protection systems',
    keywords: ['security', 'safety', 'protection', 'surveillance', 'access', 'emergency', 'fire', 'alarm'],
    examples: ['Security Services', 'Safety Equipment', 'Surveillance Systems', 'Access Control', 'Emergency Equipment']
  },
  {
    id: 'maintenance',
    name: 'Cleaning & Maintenance',
    description: 'Cleaning services, maintenance, and facility management',
    keywords: ['cleaning', 'maintenance', 'janitorial', 'repair', 'upkeep', 'sanitation', 'hygiene', 'facility'],
    examples: ['Cleaning Services', 'Maintenance Services', 'Janitorial Services', 'Facility Maintenance', 'Repair Services']
  },
  {
    id: 'supplies',
    name: 'Office Supplies & Equipment',
    description: 'Stationery, office equipment, furniture, and workplace supplies',
    keywords: ['office', 'stationery', 'furniture', 'equipment', 'supplies', 'printing', 'paper', 'desk'],
    examples: ['Office Supplies', 'Furniture Procurement', 'Stationery', 'Office Equipment', 'Printing Services']
  },
  {
    id: 'environmental',
    name: 'Environmental & Waste Management',
    description: 'Environmental services, waste management, and sustainability',
    keywords: ['environmental', 'waste', 'recycling', 'sustainability', 'pollution', 'conservation', 'disposal'],
    examples: ['Environmental Services', 'Waste Management', 'Recycling Services', 'Sustainability Services', 'Environmental Consulting']
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing & Production',
    description: 'Manufacturing equipment, production services, and industrial solutions',
    keywords: ['manufacturing', 'production', 'factory', 'industrial', 'machinery', 'equipment', 'assembly'],
    examples: ['Manufacturing Equipment', 'Production Services', 'Industrial Machinery', 'Assembly Services', 'Fabrication']
  }
];

// Helper functions
export const getCategoryById = (id: string): Category | undefined => {
  return CATEGORIES.find(category => category.id === id);
};

export const searchCategories = (query: string): Category[] => {
  const lowerQuery = query.toLowerCase();
  return CATEGORIES.filter(category => 
    category.name.toLowerCase().includes(lowerQuery) ||
    category.description.toLowerCase().includes(lowerQuery) ||
    category.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery)) ||
    category.examples.some(example => example.toLowerCase().includes(lowerQuery))
  );
};

export const getCategoryNames = (): string[] => {
  return CATEGORIES.map(category => category.name);
};

// Legacy exports for backward compatibility
export const COMMODITIES = CATEGORIES; // Alias for backward compatibility
export const getCommoditiesByCategory = (categoryName: string): Category[] => {
  return CATEGORIES.filter(category => category.name === categoryName);
};
export const getCommodityById = getCategoryById;
export const getAllCategories = getCategoryNames;
export const searchCommodities = searchCategories;
