# Batch Dossier Generator - Supabase Integration Complete

## Overview

The `batch_dossier_generator.py` has been successfully integrated with `supabase_dossier_collector.py`. Entity data can now be loaded directly from Supabase instead of requiring FalkorDB connection or manual CSV files.

## What Was Added

### New Functions in `batch_dossier_generator.py`

#### 1. `load_entities_from_supabase(limit, filters)`
Load entities from Supabase with optional filters:
- `limit`: Max number of entities to return
- `filters`: Dictionary with optional keys:
  - `sport`: Filter by sport (e.g., "Football")
  - `country`: Filter by country (e.g., "England")
  - `entity_type`: Filter by type (e.g., "CLUB", "LEAGUE", "FEDERATION")
  - `min_priority`: Minimum priority score (0-100)

#### 2. `load_entities_from_supabase_with_keywords(keywords, limit)`
Load entities matching specific keywords in their name, country, or sport:
- `keywords`: List of keywords to search for
- `limit`: Max number of entities to return

### New CLI Options

| Option | Description | Example |
|--------|-------------|---------|
| `--from-supabase` | Load entities from Supabase | `--from-supabase` |
| `--filter-sport` | Filter by sport | `--filter-sport Football` |
| `--filter-country` | Filter by country | `--filter-country England` |
| `--filter-type` | Filter by entity type | `--filter-type CLUB` |
| `--filter-min-priority` | Minimum priority score | `--filter-min-priority 70` |
| `--keywords` | Search by keywords | `--keywords Arsenal,Chelsea,Liverpool` |

## Usage Examples

### Load 50 entities from Supabase
```bash
python backend/batch_dossier_generator.py --from-supabase --limit 50
```

### Filter by Football and England
```bash
python backend/batch_dossier_generator.py --from-supabase \
    --filter-sport Football \
    --filter-country England \
    --limit 20
```

### Search for specific teams
```bash
python backend/batch_dossier_generator.py --from-supabase \
    --keywords "Arsenal,Chelsea,Liverpool,Man City,Tottenham" \
    --limit 10
```

### Generate PREMIUM dossiers for high-priority clubs
```bash
python backend/batch_dossier_generator.py --from-supabase \
    --filter-type CLUB \
    --filter-min-priority 70 \
    --tier PREMIUM \
    --limit 100
```

## Test Results

### Test 1: Basic Loading (10 entities)
```
Loaded 10 entities:
  - Suntory Sunbirds (Sports Entity) | Japan
  - La Vuelta Ciclista a España (Sports Organization) | Cycling | Spain
  - Al Shabab (Club) | Football | Saudi Arabia
  - Corinthians (Club) | Football | Brazil
  - Crystal Palace (Club) | Football | England
  - Austrian Rugby Federation (Federation) | Rugby Union | Austria
  - Entity 8839 (Person) | Hockey | Germany
  - OK Merkur Maribor (Club) | Volleyball | Slovenia
  - Laos (Country)
  - Cuba Baseball Federation (Federation) | Baseball | Cuba
```

### Test 2: Filter by Football
```
Loaded 3 Football entities:
  - Al Shabab: Saudi Arabia
  - Corinthians: Brazil
  - Crystal Palace: England
```

### Test 3: Filter by England
```
Loaded 1 England entities:
  - Crystal Palace: Football
```

### Test 4: Keyword Search (Arsenal, Chelsea, Liverpool)
```
Loaded 3 entities matching keywords:
  - Liverpool FC: Club (England)
  - Arsenal Football Club: Sports Entity (None)
  - City of Liverpool F.C.: Sports Club/Team (England)
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BATCH DOSSIER GENERATOR                       │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │ FalkorDB │        │  Supabase│        │   CSV    │
   │ (legacy) │        │(preferred)│        │  file    │
   └──────────┘        └──────────┘        └──────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  EntityRecord[] │
                    │  - entity_id    │
                    │  - entity_name  │
                    │  - entity_type  │
                    │  - priority     │
                    │  - sport/country│
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ UniversalDossier│
                    │   Generator     │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Dossier JSON   │
                    │  (11 sections)  │
                    └─────────────────┘
```

## Integration Points

### 1. Supabase Data Structure
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
    "website": "https://www.arsenal.com/",
    "founded": 1886
  },
  "badge_s3_url": "https://...",
  "priority_score": 95
}
```

### 2. EntityRecord Mapping
```python
EntityRecord(
    entity_id=se.entity_id,           # From supabase_id or neo4j_id
    entity_name=se.entity_name,        # From properties.name
    entity_type=se.entity_type,        # From properties.type or labels
    priority_score=metadata.priority,  # From priority_score column
    sport=se.sport,                    # From properties.sport
    country=se.country,                # From properties.country
    league=se.league,                  # From properties.level
    metadata={                         # Raw Supabase data
        'badge_s3_url': ...,
        'neo4j_id': ...,
        'labels': ...,
        'supabase_raw': ...
    }
)
```

## Benefits

1. **No Manual CSVs**: Entity data pulled directly from Supabase
2. **Filtering**: Easy filtering by sport, country, type, priority
3. **Keyword Search**: Find entities by name patterns
4. **Scalability**: Load 1000+ entities without CSV files
5. **Fresh Data**: Uses existing Supabase cache (real-time)

## Next Steps

1. **Full Batch Test**: Run batch generation for 100 entities
2. **Cost Tracking**: Verify estimated vs actual costs
3. **Quality Check**: Ensure generated dossiers are entity-specific
4. **Output Review**: Check dossier JSON files

## Files Modified

- `backend/batch_dossier_generator.py`: Added Supabase loading functions and CLI options
- `backend/supabase_dossier_collector.py`: Created in previous step

## Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```
