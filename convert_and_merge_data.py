#!/usr/bin/env python3
"""
Convert CSV data to JSON format and merge schemas between CSV and JSON seeds.
This script converts the Global Sports Entities CSV into the same format as sportsWorldSeed.json
and creates a unified schema that includes all fields from both sources.
"""

import csv
import json
import os
from typing import Dict, List, Any
from pathlib import Path

def load_csv_data(csv_path: str) -> List[Dict[str, Any]]:
    """Load CSV data and convert to list of dictionaries."""
    data = []
    
    with open(csv_path, 'r', encoding='latin-1') as file:
        reader = csv.DictReader(file)
        for row in reader:
            # Clean up the data
            cleaned_row = {}
            for key, value in row.items():
                if value and value.strip():
                    cleaned_row[key] = value.strip()
                else:
                    cleaned_row[key] = None
            
            # Map CSV columns to our unified schema
            entity = {
                "name": cleaned_row.get("Entity Name", ""),
                "type": cleaned_row.get("Type", ""),
                "sport": cleaned_row.get("Sport", ""),
                "country": cleaned_row.get("Country/Region", ""),
                "level": cleaned_row.get("Level/Division", ""),
                "website": cleaned_row.get("Website", ""),
                "linkedin": cleaned_row.get("LinkedIn Profile URL", ""),
                "notes": cleaned_row.get("Notes", ""),
                "source": "csv_seed",
                "tier": determine_tier(cleaned_row.get("Type", ""), cleaned_row.get("Level/Division", "")),
                "priorityScore": calculate_priority_score(cleaned_row.get("Type", ""), cleaned_row.get("Level/Division", "")),
                "estimatedValue": estimate_value(cleaned_row.get("Type", ""), cleaned_row.get("Level/Division", "")),
                "digitalWeakness": None,  # Will be filled from JSON data if available
                "opportunityType": determine_opportunity_type(cleaned_row.get("Type", ""), cleaned_row.get("Level/Division", "")),
                "mobileApp": None,  # Will be filled from JSON data if available
                "description": cleaned_row.get("Notes", "") or f"{cleaned_row.get('Type', 'Entity')} in {cleaned_row.get('Sport', 'sports')}"
            }
            data.append(entity)
    
    return data

def determine_tier(entity_type: str, level: str) -> str:
    """Determine tier based on entity type and level."""
    if not entity_type or not level:
        return "tier_3"
    
    entity_type_lower = entity_type.lower()
    level_lower = level.lower()
    
    # Tier 1: Major international organizations, top leagues
    if any(keyword in entity_type_lower for keyword in ["federation", "international", "world", "global"]):
        if any(keyword in level_lower for keyword in ["premier", "championship", "division 1", "1st division"]):
            return "tier_1"
        return "tier_2"
    
    # Tier 2: Major clubs, regional organizations
    if any(keyword in entity_type_lower for keyword in ["club", "association", "league"]):
        if any(keyword in level_lower for keyword in ["premier", "championship", "division 1", "1st division"]):
            return "tier_2"
        return "tier_3"
    
    return "tier_3"

def calculate_priority_score(entity_type: str, level: str) -> float:
    """Calculate priority score based on entity type and level."""
    base_score = 5.0
    
    if not entity_type or not level:
        return base_score
    
    entity_type_lower = entity_type.lower()
    level_lower = level.lower()
    
    # Boost for international/federation entities
    if any(keyword in entity_type_lower for keyword in ["federation", "international", "world", "global"]):
        base_score += 2.0
    
    # Boost for top-level divisions
    if any(keyword in level_lower for keyword in ["premier", "championship", "division 1", "1st division"]):
        base_score += 1.5
    
    # Boost for clubs
    if "club" in entity_type_lower:
        base_score += 1.0
    
    return min(base_score, 10.0)  # Cap at 10.0

def estimate_value(entity_type: str, level: str) -> str:
    """Estimate value based on entity type and level."""
    if not entity_type or not level:
        return "£50K-£200K"
    
    entity_type_lower = entity_type.lower()
    level_lower = level.lower()
    
    # High value for international organizations
    if any(keyword in entity_type_lower for keyword in ["federation", "international", "world", "global"]):
        if any(keyword in level_lower for keyword in ["premier", "championship"]):
            return "£1M-£5M"
        return "£500K-£2M"
    
    # Medium value for top clubs
    if "club" in entity_type_lower and any(keyword in level_lower for keyword in ["premier", "championship", "division 1"]):
        return "£500K-£1.5M"
    
    # Lower value for others
    return "£100K-£500K"

def determine_opportunity_type(entity_type: str, level: str) -> str:
    """Determine opportunity type based on entity type and level."""
    if not entity_type or not level:
        return "Website + App"
    
    entity_type_lower = entity_type.lower()
    level_lower = level.lower()
    
    # High priority for international organizations
    if any(keyword in entity_type_lower for keyword in ["federation", "international", "world", "global"]):
        return "Website + App + Digital Strategy"
    
    # Medium priority for top clubs
    if "club" in entity_type_lower and any(keyword in level_lower for keyword in ["premier", "championship", "division 1"]):
        return "Website + App + Fan Engagement"
    
    return "Website + App"

def load_json_data(json_path: str) -> Dict[str, Any]:
    """Load existing JSON data."""
    with open(json_path, 'r', encoding='utf-8') as file:
        return json.load(file)

def merge_data(csv_data: List[Dict[str, Any]], json_data: Dict[str, Any]) -> Dict[str, Any]:
    """Merge CSV and JSON data into unified format."""
    merged_data = {
        "metadata": {
            "total_entities": 0,
            "sources": ["csv_seed", "json_seed"],
            "merged_at": "2025-01-20",
            "schema_version": "2.0"
        },
        "tier_1": [],
        "tier_2": [],
        "tier_3": []
    }
    
    # Process CSV data
    for entity in csv_data:
        tier = entity.get("tier", "tier_3")
        if tier in merged_data:
            merged_data[tier].append(entity)
    
    # Process existing JSON data and add source information
    for tier in ["tier_1", "tier_2", "tier_3"]:
        if tier in json_data:
            for entity in json_data[tier]:
                # Add source and ensure all required fields exist
                enhanced_entity = {
                    "name": entity.get("name", ""),
                    "description": entity.get("description", ""),
                    "sport": entity.get("sport", ""),
                    "website": entity.get("website", ""),
                    "mobileApp": entity.get("mobileApp", False),
                    "digitalWeakness": entity.get("digitalWeakness", ""),
                    "opportunityType": entity.get("opportunityType", ""),
                    "notes": entity.get("notes", ""),
                    "tier": entity.get("tier", tier),
                    "priorityScore": entity.get("priorityScore", 5.0),
                    "estimatedValue": entity.get("estimatedValue", "£100K-£500K"),
                    "type": entity.get("type", "Organization"),
                    "country": entity.get("country", ""),
                    "level": entity.get("level", ""),
                    "linkedin": entity.get("linkedin", ""),
                    "source": "json_seed"
                }
                merged_data[tier].append(enhanced_entity)
    
    # Calculate total entities
    merged_data["metadata"]["total_entities"] = (
        len(merged_data["tier_1"]) + 
        len(merged_data["tier_2"]) + 
        len(merged_data["tier_3"])
    )
    
    return merged_data

def save_merged_data(data: Dict[str, Any], output_path: str):
    """Save merged data to JSON file."""
    with open(output_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
    
    print(f"✅ Merged data saved to: {output_path}")
    print(f"📊 Total entities: {data['metadata']['total_entities']}")
    print(f"   - Tier 1: {len(data['tier_1'])}")
    print(f"   - Tier 2: {len(data['tier_2'])}")
    print(f"   - Tier 3: {len(data['tier_3'])}")

def main():
    """Main function to convert and merge data."""
    # Define paths
    base_path = Path("../yellow-panther-ai/scraping_data")
    csv_path = base_path / "Global Sports Entities_AIBiztool.csv"
    json_path = base_path / "sportsWorldSeed.json"
    output_path = "merged_sports_data.json"
    
    print("🔄 Starting data conversion and merge process...")
    
    # Check if files exist
    if not csv_path.exists():
        print(f"❌ CSV file not found: {csv_path}")
        return
    
    if not json_path.exists():
        print(f"❌ JSON file not found: {json_path}")
        return
    
    try:
        # Load CSV data
        print("📊 Loading CSV data...")
        csv_data = load_csv_data(str(csv_path))
        print(f"   ✅ Loaded {len(csv_data)} entities from CSV")
        
        # Load JSON data
        print("📄 Loading JSON data...")
        json_data = load_json_data(str(json_path))
        print(f"   ✅ Loaded JSON data with {sum(len(json_data.get(tier, [])) for tier in ['tier_1', 'tier_2', 'tier_3'])} entities")
        
        # Merge data
        print("🔗 Merging data...")
        merged_data = merge_data(csv_data, json_data)
        
        # Save merged data
        print("💾 Saving merged data...")
        save_merged_data(merged_data, output_path)
        
        print("🎉 Data conversion and merge completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during conversion: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
