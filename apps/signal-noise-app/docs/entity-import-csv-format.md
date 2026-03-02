# Entity Import CSV Format

Required columns:
- `name`
- `entity_type`
- `sport`
- `country`
- `source`

Optional columns:
- `external_id`
- `website`
- `league`
- `founded_year`
- `headquarters`
- `stadium_name`
- `capacity`
- `description`
- `priority_score`
- `badge_url`

Example:

```csv
name,entity_type,sport,country,source,website,league,priority_score
Arsenal FC,CLUB,Football,England,csv_import,https://www.arsenal.com,Premier League,90
```
