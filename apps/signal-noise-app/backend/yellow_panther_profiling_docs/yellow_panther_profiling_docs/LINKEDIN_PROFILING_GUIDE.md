# LinkedIn Profiling System - Updated Architecture

## BrightData-Only Architecture

**Important**: This system uses **BrightData scraping exclusively** - NO official LinkedIn API required!

```
LinkedInProfiler
    │
    ├─> scrape_linkedin_posts()           [Detect RFP signals, tech needs]
    ├─> scrape_mutual_connections()        [Find Yellow Panther connections]
    ├─> scrape_company_posts()             [Opportunity detection]
    └─> profile_entity()                   [Multi-pass profiling]
            │
            ├─ Pass 1: scrape_jobs_board()  [BrightData cached]
            ├─ Pass 2: search_engine()      [BrightData targeted]
            └─ Pass 3+: Hybrid approach     [BrightData cache warming]
```

## What BrightData Can Scrape

### ✅ LinkedIn Data Sources (All via BrightData)

1. **Company Pages**
   - Company info and description
   - Employee count and growth
   - Industry and location
   - Recent posts and updates

2. **Personal Profiles**
   - Name, title, company
   - Career history
   - Education and skills
   - Connections and activity

3. **Job Postings**
   - Job title and description
   - Requirements and skills
   - Posting date and location
   - Application links

4. **Posts and Activity**
   - Company posts
   - Individual posts
   - Comments and engagement
   - Publication dates

5. **Network Data**
   - Mutual connections (displayed on profiles)
   - Connection strength indicators
   - Network overlap

## New Features

### 1. LinkedIn Post Signal Detection

**Purpose**: Detect procurement signals in LinkedIn posts

**What it finds**:
- RFP announcements
- Technology needs
- Partnership requests
- Digital transformation initiatives
- Budget indicators

**Usage**:
```python
posts = await profiler.scrape_linkedin_posts(
    entity_name="Arsenal FC",
    max_posts=20
)

for post in posts:
    print(f"Signals: {post['signals']}")
    print(f"Content: {post['content'][:100]}...")
```

**Example Output**:
```python
{
    'content': 'We are seeking proposals for a new CRM system...',
    'signals': ['RFP_SIGNAL', 'TECHNOLOGY_NEED'],
    'confidence': 0.85,
    'scraped_at': '2026-02-07T12:00:00Z'
}
```

### 2. Mutual Connections Discovery

**Purpose**: Find mutual connections between Yellow Panther and target entities

**Use cases**:
- Warm introductions
- Relationship mapping
- Partnership opportunities
- Network analysis

**Usage**:
```python
yellow_panther_url = "https://linkedin.com/company/yellow-panther"
mutuals = await profiler.scrape_mutual_connections(
    yellow_panther_url,
    target_entity_profiles
)

for entity_id, connections in mutuals.items():
    print(f"{entity_id}: {len(connections)} mutual connections")
```

**Example Output**:
```python
{
    'arsenal-fc': [
        {
            'connection_name': 'John Smith',
            'connection_title': 'CTO',
            'context': 'Former colleague at TechCorp',
            'strength': 'STRONG'
        }
    ]
}
```

### 3. Company Post Opportunity Detection

**Purpose**: Find procurement opportunities in company LinkedIn posts

**What it detects**:
- RFP signals
- Technology needs
- Partnership opportunities
- Hiring signals
- Budget indicators

**Usage**:
```python
opportunities = await profiler.scrape_company_posts_for_opportunities(
    entity_name="Arsenal FC"
)

for opp in opportunities:
    print(f"Type: {opp['opportunity_type']}")
    print(f"Pattern: {opp['pattern_matched']}")
    print(f"Context: {opp['context']}")
```

**Example Output**:
```python
{
    'opportunity_type': 'RFP_SIGNAL',
    'pattern_matched': 'request for proposal',
    'context': 'We are issuing a request for proposal for CRM...',
    'confidence': 0.9,
    'source_url': 'https://linkedin.com/company/arsenal-fc/posts/12345'
}
```

## Updated Sweep Flow

```
Pass 1: Quick Sweep (30s, $0.0005)
    ├─> Jobs board scraping (BrightData)
    └─> Company page discovery

Pass 2: Targeted Sweep (60s, $0.010)
    ├─> Executive search (BrightData)
    └─> Profile URL discovery

Pass 3: Deep Sweep (120s, $0.050)
    ├─> LinkedIn posts scraping ✨ NEW
    ├─> Mutual connections ✨ NEW
    ├─> Opportunity detection ✨ NEW
    └─> Full profile enrichment

Pass 4+: Monitoring (90s, $0.015)
    ├─> Post monitoring for new signals
    ├─> Connection tracking
    └─> Opportunity updates
```

## Data Storage

### Entity Profile Enrichment

```python
profile = EntityProfile(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",

    # LinkedIn profiles
    linkedin_profiles=[...],

    # Decision makers
    decision_makers=[...],

    # ✨ NEW: LinkedIn posts with signals
    linkedin_posts=[
        {
            'post_id': 'post_123',
            'entity_id': 'arsenal-fc',
            'content': 'We are seeking...',
            'signals': ['RFP_SIGNAL', 'TECHNOLOGY_NEED'],
            'opportunity_type': 'RFP_SIGNAL',
            'confidence': 0.85
        }
    ],

    # ✨ NEW: Mutual connections
    mutual_connections=[
        {
            'connection_id': 'conn_456',
            'yellow_panther_entity': 'yellow-panther',
            'target_entity': 'arsenal-fc',
            'connection_name': 'John Smith',
            'connection_title': 'CTO at Arsenal FC',
            'strength': 'STRONG'
        }
    ],

    # ✨ NEW: Opportunities detected
    opportunities_detected=[
        {
            'opportunity_type': 'RFP_SIGNAL',
            'pattern_matched': 'request for proposal',
            'context': 'Arsenal FC is issuing an RFP...',
            'confidence': 0.9
        }
    ]
)
```

## Graphiti Episodes

New episode types to store in Graphiti:

```python
from schemas import LinkedInEpisodeType

# Create episodes for tracking
await graphiti.create_episode(
    entity_id="arsenal-fc",
    episode_type=LinkedInEpisodeType.POST_SIGNAL_DETECTED,
    source_description="LinkedIn post with RFP signal",
    episode_content={
        'post_url': 'https://linkedin.com/company/arsenal-fc/posts/12345',
        'signals': ['RFP_SIGNAL'],
        'confidence': 0.85
    }
)

await graphiti.create_episode(
    entity_id="arsenal-fc",
    episode_type=LinkedInEpisodeType.MUTUAL_CONNECTION_FOUND,
    source_description="Mutual connection with Yellow Panther",
    episode_content={
        'connection_name': 'John Smith',
        'strength': 'STRONG',
        'context': 'Former TechCorp colleague'
    }
)

await graphiti.create_episode(
    entity_id="arsenal-fc",
    episode_type=LinkedInEpisodeType.OPPORTUNITY_DETECTED,
    source_description="CRM procurement opportunity",
    episode_content={
        'opportunity_type': 'RFP_SIGNAL',
        'confidence': 0.9,
        'context': 'RFP for CRM system'
    }
)
```

## Signal Types Detected

### Post Signals
1. **RFP_SIGNAL**: Request for proposal mentioned
2. **TECHNOLOGY_SIGNAL**: Technology needs discussed
3. **HIRING_SIGNAL**: Active hiring in relevant areas
4. **PARTNERSHIP_SIGNAL**: Seeking partners/vendors
5. **EXPANSION_SIGNAL**: Growth/expansion indicators

### Opportunity Types
1. **RFP_SIGNAL**: Direct RFP announcement
2. **TECHNOLOGY_NEED**: Looking for technology solutions
3. **DIGITAL_INITIATIVE**: Digital transformation project
4. **PARTNERSHIP_OPPORTUNITY**: Open to partnerships
5. **HIRING_SIGNAL**: Team expansion (indicates budget)
6. **BUDGET_INDICATOR**: Investment/budget mentioned

## Connection Strength

**STRONG**: Direct previous relationship
- Former colleagues
- Known business partners
- Shared projects

**MEDIUM**: 2nd-degree connections
- Same industry
- Shared connections
- Alumni networks

**WEAK**: 3rd-degree or tangential
- Industry adjacent
- Geographic proximity
- Event attendance

## Integration with Discovery

The LinkedIn data now feeds into hypothesis-driven discovery:

```python
from hypothesis_driven_discovery import HypothesisDrivenDiscovery

discovery = HypothesisDrivenDiscovery(claude, brightdata)

# Use LinkedIn signals to guide discovery
if profile.linkedin_posts:
    rfp_signals = [p for p in profile.linkedin_posts if 'RFP_SIGNAL' in p['signals']]

    for signal in rfp_signals:
        # Prioritize RFP-related hypotheses
        result = await discovery.run_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            template_id="rfp_responsive_template",
            priority_boost=0.2  # Boost priority for RFP signals
        )

# Use mutual connections for warm outreach
if profile.mutual_connections:
    strong_connections = [
        c for c in profile.mutual_connections
        if c['strength'] == 'STRONG'
    ]

    # Add to dossier as outreach targets
    dossier.outreach_contacts = strong_connections
```

## Performance Impact

### Additional Cost
- **Posts scraping**: +5-10 seconds, +$0.002 per entity
- **Mutual connections**: +3-5 seconds, +$0.001 per entity
- **Opportunity detection**: Included in posts scraping

### Updated Total Costs
| Pass | Original | With LinkedIn Features | Total |
|------|----------|----------------------|-------|
| 1 | $0.0005 | +$0.000 | $0.0005 |
| 2 | $0.010 | +$0.000 | $0.010 |
| 3 | $0.050 | +$0.003 | $0.053 |
| 4+ | $0.015 | +$0.002 | $0.017 |
| **Total** | **$0.076** | **+$0.005** | **$0.081** |

**Cost increase**: <7% for significant signal detection capability

## Usage Examples

### Complete LinkedIn Profiling

```python
from linkedin_profiler import LinkedInProfiler
from brightdata_sdk_client import BrightDataSDKClient

brightdata = BrightDataSDKClient()
profiler = LinkedInProfiler(brightdata)

# Multi-pass profiling
profiles = await profiler.profile_entity("Arsenal FC", pass_number=3)

# Extract posts with signals
posts = await profiler.scrape_linkedin_posts("Arsenal FC", max_posts=20)
rfp_posts = [p for p in posts if 'RFP_SIGNAL' in p['signals']]

# Find mutual connections
mutuals = await profiler.scrape_mutual_connections(
    yellow_panther_url="https://linkedin.com/company/yellow-panther",
    target_entity_profiles=profiles
)

# Detect opportunities
opportunities = await profiler.scrape_company_posts_for_opportunities("Arsenal FC")

print(f"RFP posts: {len(rfp_posts)}")
print(f"Mutual connections: {len(mutuals)}")
print(f"Opportunities: {len(opportunities)}")
```

### Integration with Temporal Sweep

```python
from temporal_sweep_scheduler import TemporalSweepScheduler

scheduler = TemporalSweepScheduler(claude, brightdata)

# Run sweep with LinkedIn features enabled
result = await scheduler.execute_sweep(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    pass_number=3  # Deep sweep with LinkedIn
)

# Access LinkedIn data
profile = result.entity_profile
print(f"Posts with signals: {len(profile.linkedin_posts)}")
print(f"Mutual connections: {len(profile.mutual_connections)}")
print(f"Opportunities: {len(profile.opportunities_detected)}")

# Check for RFP signals
rfp_signals = [
    p for p in profile.linkedin_posts
    if 'RFP_SIGNAL' in p.get('signals', [])
]

if rfp_signals:
    print(f"🚨 RFP SIGNALS DETECTED: {len(rfp_signals)}")
```

## Testing

Test the new features:

```python
import asyncio
from linkedin_profiler import LinkedInProfiler
from brightdata_sdk_client import BrightDataSDKClient

async def test_linkedin_features():
    brightdata = BrightDataSDKClient()
    profiler = LinkedInProfiler(brightdata)

    entity_name = "Arsenal FC"

    # Test 1: Posts scraping
    print("Testing posts scraping...")
    posts = await profiler.scrape_linkedin_posts(entity_name)
    print(f"✅ Scraped {len(posts)} posts")

    # Test 2: Opportunities
    print("Testing opportunity detection...")
    opportunities = await profiler.scrape_company_posts_for_opportunities(entity_name)
    print(f"✅ Found {len(opportunities)} opportunities")

    # Test 3: Mutual connections
    print("Testing mutual connections...")
    profiles = await profiler.profile_entity(entity_name, pass_number=1)
    mutuals = await profiler.scrape_mutual_connections(
        "https://linkedin.com/company/yellow-panther",
        profiles
    )
    print(f"✅ Found {len(mutuals)} mutual connections")

asyncio.run(test_linkedin_features())
```

## Summary

✅ **BrightData Only**: No official LinkedIn API needed
✅ **Post Signals**: Detect RFPs, tech needs, opportunities
✅ **Mutual Connections**: Find warm introduction paths
✅ **Opportunity Detection**: Identify procurement opportunities
✅ **Minimal Cost**: +$0.005 per entity for full LinkedIn intelligence
✅ **Production Ready**: All features integrated and tested

---

**Updated**: February 7, 2026
**Status**: Enhanced with post signals, mutual connections, and opportunity detection
