#!/usr/bin/env python3
"""
Extract CSD Commodities List from National Treasury PDF
Purpose: Download and parse the official CSD commodities guide
"""

import requests
import json
import PyPDF2
from io import BytesIO
import re

def extract_csd_commodities():
    """Extract commodities from National Treasury CSD guide"""
    
    # Download commodities guide from National Treasury
    url = "https://www.treasury.gov.za/comm_media/press/2020/Commodities%20Guide%20%20Supplier%20V1.pdf"
    
    try:
        print("📥 Downloading CSD Commodities Guide from National Treasury...")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        pdf_data = BytesIO(response.content)
        
        # Read PDF
        print("📖 Reading PDF content...")
        reader = PyPDF2.PdfReader(pdf_data)
        text = ""
        for page in reader.pages:
            if page.extract_text():
                text += page.extract_text() + "\n"
        
        # Parse into a clean list of commodities
        print("🔍 Parsing commodities...")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        
        # Filter and clean commodities
        commodities = []
        for line in lines:
            # Skip page numbers, headers, and very short lines
            if (len(line) > 3 and 
                not line.isdigit() and 
                not re.match(r'^[A-Z\s]+$', line) and  # Skip all caps headers
                not line.startswith('Page') and
                not line.startswith('Commodities Guide') and
                'Treasury' not in line and
                'Government' not in line):
                commodities.append(line)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_commodities = []
        for commodity in commodities:
            if commodity.lower() not in seen:
                seen.add(commodity.lower())
                unique_commodities.append(commodity)
        
        print(f"✅ Extracted {len(unique_commodities)} unique commodities")
        
        # Save to JSON file
        output_file = "csd_commodities.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(unique_commodities, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved commodities to {output_file}")
        
        # Also create a categorized version
        categorized_commodities = categorize_commodities(unique_commodities)
        
        categorized_file = "csd_commodities_categorized.json"
        with open(categorized_file, "w", encoding="utf-8") as f:
            json.dump(categorized_commodities, f, indent=2, ensure_ascii=False)
        
        print(f"📂 Saved categorized commodities to {categorized_file}")
        
        return unique_commodities, categorized_commodities
        
    except Exception as e:
        print(f"❌ Error extracting commodities: {e}")
        return [], {}

def categorize_commodities(commodities):
    """Categorize commodities into logical groups"""
    
    categories = {
        "Construction & Infrastructure": [],
        "Information Technology": [],
        "Healthcare & Medical": [],
        "Education & Training": [],
        "Transportation & Logistics": [],
        "Energy & Utilities": [],
        "Agriculture & Food": [],
        "Professional Services": [],
        "Security & Safety": [],
        "Cleaning & Maintenance": [],
        "Office Supplies & Equipment": [],
        "Environmental & Waste Management": [],
        "Manufacturing & Production": [],
        "Other": []
    }
    
    # Keywords for categorization
    category_keywords = {
        "Construction & Infrastructure": [
            "construction", "building", "infrastructure", "civil", "engineering", 
            "road", "bridge", "water", "sewer", "electrical", "mechanical", "plumbing"
        ],
        "Information Technology": [
            "software", "hardware", "computer", "IT", "technology", "digital", 
            "telecommunications", "network", "system", "database", "application"
        ],
        "Healthcare & Medical": [
            "medical", "health", "healthcare", "pharmaceutical", "hospital", 
            "clinic", "medicine", "equipment", "diagnostic", "therapeutic"
        ],
        "Education & Training": [
            "education", "training", "learning", "school", "university", 
            "curriculum", "teaching", "student", "academic", "educational"
        ],
        "Transportation & Logistics": [
            "transport", "vehicle", "logistics", "shipping", "freight", 
            "delivery", "fleet", "aviation", "railway", "fuel"
        ],
        "Energy & Utilities": [
            "energy", "power", "electricity", "renewable", "solar", "wind", 
            "utility", "generation", "distribution", "transmission"
        ],
        "Agriculture & Food": [
            "agriculture", "farming", "food", "livestock", "crop", "irrigation", 
            "fertilizer", "seed", "harvest", "catering"
        ],
        "Professional Services": [
            "consulting", "legal", "accounting", "audit", "advisory", "management", 
            "financial", "business", "professional", "expert"
        ],
        "Security & Safety": [
            "security", "safety", "protection", "surveillance", "access", 
            "emergency", "fire", "alarm", "guard", "monitoring"
        ],
        "Cleaning & Maintenance": [
            "cleaning", "maintenance", "janitorial", "repair", "upkeep", 
            "sanitation", "hygiene", "facility", "service"
        ],
        "Office Supplies & Equipment": [
            "office", "stationery", "furniture", "equipment", "supplies", 
            "printing", "paper", "desk", "chair", "computer"
        ],
        "Environmental & Waste Management": [
            "environmental", "waste", "recycling", "sustainability", "pollution", 
            "conservation", "disposal", "treatment", "green"
        ],
        "Manufacturing & Production": [
            "manufacturing", "production", "factory", "industrial", "machinery", 
            "equipment", "assembly", "processing", "fabrication"
        ]
    }
    
    for commodity in commodities:
        commodity_lower = commodity.lower()
        categorized = False
        
        for category, keywords in category_keywords.items():
            if any(keyword in commodity_lower for keyword in keywords):
                categories[category].append(commodity)
                categorized = True
                break
        
        if not categorized:
            categories["Other"].append(commodity)
    
    return categories

if __name__ == "__main__":
    commodities, categorized = extract_csd_commodities()
    
    if commodities:
        print("\n📋 Sample commodities:")
        for i, commodity in enumerate(commodities[:10]):
            print(f"  {i+1}. {commodity}")
        
        print(f"\n📊 Categories summary:")
        for category, items in categorized.items():
            if items:
                print(f"  {category}: {len(items)} items")
    else:
        print("❌ No commodities extracted")
