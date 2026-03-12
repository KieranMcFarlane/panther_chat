# Supabase Dossier Collector - Implementation Summary

## Overview

The `supabase_dossier_collector.py` module successfully bridges the gap between the existing Supabase `cached_entities` table and the new dossier generation system. Instead of requiring manual CSV population, entity data is pulled directly from Supabase.

## What Was Built

### File: `backend/supabase_dossier_collector.py`

A Python module that:
1. Connects to the existing Supabase `cached_entities` table
2. Parses entity data from the JSONB `properties` column
3. Provides convenience functions for single and batch entity retrieval
4. Exports data to CSV format for template compatibility if needed

## How It Works

### Supabase Schema Understanding

The `cached_entities` table stores entity data in a `properties` JSONB column:

```json
{
  "id": "uuid",
  "neo4j_id": "text",
  "labels": ["Entity", "Club"],
  "properties": {
    "name": "Arsenal",
    "type": "Club",
    "sport": "Football",
    "country": "England",
    "level": "Premier League",
    "about": "Club description...",
    "website": "https://www.arsenal.com/",
    "founded": 1886,
    "stadium": "Emirates Stadium"
  },
  "badge_s3_url": "https://...",
  "priority_score": 95
}
```

### Key Functions

#### `get_entity(entity_id: str) -> Optional[SupabaseEntity]`
- Searches for entity by name (exact match, prefix, or contains)
- Returns a `SupabaseEntity` dataclass with parsed properties

#### `get_all_entities(limit: Optional[int] = None) -> List[SupabaseEntity]`
- Retrieves all entities (or limited subset)
- Useful for batch processing

#### `get_dossier_data(entity_id: str) -> Dict[str, Any]`
- Returns comprehensive dossier data for an entity
- Includes leadership data if available

#### `export_to_csv_format(output_dir: str)`
- Exports all entities to CSV files
- Compatible with existing dossier templates

## Usage Examples

### CLI Interface

```bash
# Get specific entity
python backend/supabase_dossier_collector.py --entity-id arsenal --verbose

# List entities
python backend/supabase_dossier_collector.py --limit 10 --verbose

# Export to CSV
python backend/supabase_dossier_collector.py --export-csv --output-dir data/dossier_exports
```

### Python API

```python
from backend.supabase_dossier_collector import get_entity_for_dossier

# Get single entity
data = get_entity_for_dossier("arsenal")
print(data['entity_name'])  # "Arsenal"
print(data['website'])      # "https://www.arsenal.com/"

# Get all entities for batch processing
from backend.supabase_dossier_collector import get_all_entities_for_batch
entities = get_all_entities_for_batch(limit=100)
```

## Test Results

### Successfully Tested Entities

| Entity ID | Name | Sport | Country | League | Website |
|-----------|------|-------|---------|--------|---------|
| arsenal | Arsenal | Football | England | - | https://www.arsenal.com/ |
| chelsea | Chelsea | Football | England | - | https://www.chelseafc.com/ |
| liverpool | Liverpool | Football | England | Premier League | https://www.liverpoolfc.com/ |
| crystal-palace | Crystal Palace | Football | England | - | https://www.cpfc.co.uk/ |

### Data Export Results

- **1000+ entities** exported from Supabase
- **core_info.csv** generated with proper column mappings
- Founded years correctly parsed from `{'low': 1910, 'high': 0}` format
- Entity types inferred from labels when not explicitly set

## Integration Points

### With Batch Dossier Generator

The `batch_dossier_generator.py` can use `SupabaseDataCollector` as its data source:

```python
from backend.supabase_dossier_collector import SupabaseDataCollector

# In batch_dossier_generator.py
collector = SupabaseDataCollector()
entities = collector.get_all_entities(limit=100)

for entity in entities:
    dossier_data = collector.get_dossier_data(entity.entity_id)
    # Generate dossier from this data
```

### With Connections Analyzer

Leadership data can be pulled from Supabase (if the leadership table exists):

```python
collector = SupabaseDataCollector()
leadership = collector.get_leadership("arsenal-fc")

# If leadership table exists, this returns:
# [
#   {
#     "entity_id": "arsenal-fc",
#     "person_name": "Juliet Slot",
#     "role": "Commercial Director",
#     "linkedin_url": "https://...",
#     ...
#   }
# ]
```

## Known Limitations

1. **Leadership Table**: The leadership table doesn't exist in Supabase yet (returns 404)
   - Workaround: Use the `keyPersonnel` field in properties for basic leadership info

2. **Sparse Properties**: Some entities have minimal data (only name, sport, country)
   - Solution: Use BrightData SDK to enrich these entities

3. **Entity ID Format**: Different entities use different ID formats
   - Some use `supabase_id` (e.g., `arsenal_210`)
   - Some use `neo4j_id` (e.g., `132`)
   - Some use UUID
   - Solution: Search by name for flexibility

## Next Steps

1. **Integrate with batch generator**: Use `SupabaseDataCollector` in `batch_dossier_generator.py`
2. **Create leadership table**: If leadership data exists, add to Supabase
3. **Enrich sparse entities**: Use BrightData SDK to fill in missing properties
4. **Test with 100-entity batch**: Verify performance and data quality

## Files Created/Modified

- **Created**: `backend/supabase_dossier_collector.py` (~480 lines)
- **CSV Templates**: `data/dossier_templates/*.csv` (already created)

## Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```
