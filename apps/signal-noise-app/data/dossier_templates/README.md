# Dossier CSV Templates

This directory contains CSV templates for collecting data to support scalable dossier generation across 3,000+ entities.

## Template Files

### Static Reference Data (Update infrequently)

- **yp_team.csv** - Yellow Panther UK team members (connections analysis)
- **bridge_contacts.csv** - Tier 2 network contacts (connections analysis)

### Entity-Specific Data (Per entity)

- **core_info.csv** - Basic entity metadata (BASIC tier)
- **digital_stack_template.csv** - Technology platforms (STANDARD tier)
- **leadership_template.csv** - Decision makers (STANDARD tier, CRITICAL for connections)
- **target_personnel_template.csv** - LinkedIn URLs for connections (PREMIUM tier)
- **opportunities_template.csv** - Partnership opportunities (PREMIUM tier)
- **news_template.csv** - Recent news (BASIC tier)

## How to Use These Templates

### 1. For Single Entity Data Collection

Copy the relevant template, fill in entity-specific data, and import to the system:

```bash
# Example for Arsenal FC
cp leadership_template.csv arsenal_leadership.csv
# Edit arsenal_leadership.csv with actual Arsenal leadership data
```

### 2. For Batch Entity Data Collection

1. Export entity list from FalkorDB
2. For each entity, fill in applicable templates
3. Combine all entity data into single CSV files per template type

### 3. For Connections Analysis

Connections analysis requires THREE data sources:

1. **yp_team.csv** (Static - already provided)
   - Yellow Panther team member names, roles, LinkedIn URLs

2. **target_personnel.csv** (Per entity)
   - Target entity staff names, roles, LinkedIn URLs
   - Format: entity_id, person_name, role, linkedin_url, mutual_connections_yp, count_second_degree_paths

3. **bridge_contacts.csv** (Static - already provided)
   - Industry contacts who can facilitate introductions

## Data Quality Rules

### Leadership / Target Personnel

- **REAL names only** - NO placeholders like `{FEDERATION PRESIDENT}`
- **Specific titles** - "Commercial Director" not "Director"
- **LinkedIn URLs** - Include when available
- Use "unknown" when information cannot be found

### Opportunities

- Be specific about opportunity type
- Include realistic budget estimates (aligned with YP pricing: £80K-£500K)
- Tag with YP service categories

### News

- Focus on procurement/partnership relevant news
- Include relevance scores
- Tag with signal types: [PROCUREMENT], [CAPABILITY], [TIMING], [CONTACT]

## CSV Import Format

All CSVs use standard comma-separated format with:
- First row: Header row
- Subsequent rows: Data records
- String fields: Quote with double quotes if containing commas
- Date fields: ISO 8601 format (YYYY-MM-DD)
- JSON fields: String representation of JSON array

## Automation

These templates can be used with:
- BrightData SDK for web scraping
- LinkedIn Sales Navigator API for contact data
- Custom scripts for FalkorDB export
