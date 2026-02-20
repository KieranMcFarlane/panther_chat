# HTTP Scraper Mechanics: From EIG to URL to HTTP Request

## The Question

How does "Hypotheses → EIG → MCP-guided hop selection" actually become a specific HTTP request to scrape a URL?

**Answer**: It's a **multi-step translation process**:

```
Hypothesis (with EIG score)
  ↓
Hop Type Selection (based on channel ROI × EIG)
  ↓
Search Query Generation (hop type → Google search query)
  ↓
BrightData Search API (Google SERP → URL)
  ↓
BrightData Scrape API (HTTP GET → Markdown content)
  ↓
Claude Evaluation (Haiku/Sonnet/Opus → Decision)
  ↓
Update Hypothesis (new confidence, evidence)
  ↓
Repeat...
```

---

## Step-by-Step Implementation

### Step 1: Hypothesis with EIG Score

```python
# Hypothesis object
hypothesis = Hypothesis(
    hypothesis_id="arsenal_fc_react_mobile_rfp",
    entity_id="arsenal-fc",
    category="Mobile Development",
    statement="Arsenal FC seeking React Native mobile app development",
    confidence=0.56,  # Current confidence
    iterations_attempted=3,
    expected_information_gain=0.24  # ← EIG score calculated
)

# How EIG was calculated:
# EIG = (1 - confidence) × novelty × information_value
# EIG = (1 - 0.56) × 0.8 × 1.2
# EIG = 0.44 × 0.8 × 1.2 = 0.422

# Wait, EIG also considers temporal and network boosts:
# EIG_final = EIG_base × temporal_boost × network_boost
# EIG_final = 0.422 × 1.0 × 1.0 = 0.422
```

---

### Step 2: MCP-Guided Hop Type Selection

**File**: `backend/hypothesis_driven_discovery.py` (lines 551-641)

```python
def _choose_next_hop(self, hypothesis, state) -> HopType:
    """
    Choose next hop type using MCP-guided scoring

    Formula:
    Score = Channel_ROI × Base_EIG - Penalties
    """

    # Get base EIG from hypothesis
    base_eig = hypothesis.expected_information_gain  # 0.422

    # Score all hop types
    hop_scores = {}

    # Map hop types to source types for ROI lookup
    hop_source_mapping = {
        HopType.PRESS_RELEASE: SourceType.PRESS_RELEASES,
        HopType.OFFICIAL_SITE: SourceType.TECH_NEWS_ARTICLES,
        HopType.CAREERS_PAGE: SourceType.LEADERSHIP_JOB_POSTINGS,
        HopType.ANNUAL_REPORT: SourceType.PRESS_RELEASES,
        HopType.LINKEDIN_JOB: SourceType.LINKEDIN_JOBS_OPERATIONAL
    }

    # Channel ROI multipliers (from historical data)
    CHANNEL_ROI = {
        SourceType.PARTNERSHIP_ANNOUNCEMENT: 0.35,  # 35% of ACCEPT signals
        SourceType.TECH_NEWS_ARTICLES: 0.25,        # 25% of ACCEPT signals
        SourceType.PRESS_RELEASES: 0.10,             # 10% of ACCEPT signals
        SourceType.LEADERSHIP_JOB_POSTINGS: 0.08,    # 8% of ACCEPT signals
        SourceType.LINKEDIN_JOBS_OPERATIONAL: 0.01    # 1% (mostly noise)
    }

    # Calculate score for each hop type
    for hop_type, source_type in hop_source_mapping.items():
        # Get channel ROI
        channel_roi = CHANNEL_ROI.get(source_type, 0.05)

        # Calculate score
        score = channel_roi * base_eig

        # Example:
        # PRESS_RELEASE: 0.10 × 0.422 = 0.0422
        # TECH_NEWS: 0.25 × 0.422 = 0.1055  ← Winner!
        # CAREERS_PAGE: 0.08 × 0.422 = 0.0338

        hop_scores[hop_type] = score

    # Select highest scoring hop
    best_hop = max(hop_scores.items(), key=lambda x: x[1])[0]

    # Result: HopType.OFFICIAL_SITE (mapped to TECH_NEWS_ARTICLES)
    logger.info(f"MCP-guided hop selection: {best_hop} (score: {hop_scores[best_hop]:.3f})")

    return best_hop
```

**In this example**:
- **Hypothesis**: Arsenal seeking React mobile app development
- **EIG**: 0.422 (high uncertainty, high value)
- **Best hop**: `OFFICIAL_SITE` (uses tech news strategy)
- **Score**: 0.1055 (highest)

---

### Step 3: Generate Search Query from Hop Type

**File**: `backend/hypothesis_driven_discovery.py` (lines 744-819)

```python
async def _get_url_for_hop(self, hop_type, hypothesis, state):
    """
    Get URL to scrape based on hop type

    Process:
    1. Map hop type to search query
    2. Search Google for relevant URL
    3. Return first result
    4. Fallback to alternative queries if primary fails
    """

    entity_name = state.entity_name  # "Arsenal FC"

    # Define primary search query for each hop type
    primary_queries = {
        HopType.OFFICIAL_SITE: '"Arsenal FC" official website',
        HopType.CAREERS_PAGE: '"Arsenal FC" careers jobs',
        HopType.ANNUAL_REPORT: '"Arsenal FC" annual report 2024',
        HopType.PRESS_RELEASE: '"Arsenal FC" recent news press release',
        HopType.LINKEDIN_JOB: '"Arsenal FC" jobs careers site:linkedin.com'
    }

    # Get primary query for selected hop type
    primary_query = primary_queries.get(hop_type)
    # For OFFICIAL_SITE: '"Arsenal FC" official website'

    logger.debug(f"Primary search query: {primary_query}")

    # Try primary search
    search_result = await self.brightdata_client.search_engine(
        query=primary_query,
        engine='google',
        num_results=1  # Only need first result
    )

    # Check if search succeeded
    if search_result.get('status') == 'success' and search_result.get('results'):
        url = search_result['results'][0].get('url')
        if url:
            logger.info(f"✓ Primary search found URL: {url}")
            return url

    # If primary failed, try fallback queries
    logger.warning(f"⚠️ Primary search failed for {hop_type}, trying fallbacks")

    fallback_queries = self._get_fallback_queries(hop_type, entity_name)

    for i, fallback_query in enumerate(fallback_queries, 1):
        logger.debug(f"Fallback {i}/{len(fallback_queries)}: {fallback_query}")

        search_result = await self.brightdata_client.search_engine(
            query=fallback_query,
            engine='google',
            num_results=1
        )

        if search_result.get('status') == 'success':
            url = search_result['results'][0].get('url')
            if url:
                logger.info(f"✓ Fallback {i} found URL: {url}")
                return url

    # All searches failed
    logger.error(f"❌ All search queries failed for {hop_type}")
    return None
```

**Example Search Query**:

```python
# Hop type: OFFICIAL_SITE
# Entity name: "Arsenal FC"

primary_query = '"Arsenal FC" official website'

# This becomes a Google search:
# https://www.google.com/search?q="Arsenal%20FC"%20official%20website

# Google returns:
search_result = {
    "status": "success",
    "results": [
        {
            "position": 1,
            "title": "Arsenal FC's Official Website",
            "url": "https://www.arsenal.com",  # ← This is what we want!
            "snippet": "The official Arsenal FC website..."
        }
    ]
}
```

---

### Step 4: BrightData Search API Call

**File**: `backend/brightdata_sdk_client.py` (lines 91-189)

```python
async def search_engine(
    self,
    query: str,
    engine: str = "google",
    country: str = "us",
    num_results: int = 10
) -> Dict[str, Any]:
    """
    Search using BrightData SERP API

    This makes an HTTP request to BrightData's servers,
    which then perform the Google search and return results.

    Args:
        query: Search query
        engine: 'google', 'bing', or 'yandex'
        country: Country code
        num_results: Number of results

    Returns:
        Search results with position, title, url, snippet
    """

    try:
        logger.info(f"🔍 BrightData search: {query} (engine: {engine})")

        # Get BrightData SDK client
        client = await self._get_client()

        # Call BrightData SDK (which makes HTTP request to BrightData servers)
        if engine.lower() == "google":
            result = await client.search.google(
                query=query,          # '"Arsenal FC" official website'
                country=country,      # 'us'
                num=num_results       # 1
            )

        # Result structure:
        # result.data[0].title = "Arsenal FC's Official Website"
        # result.data[0].url = "https://www.arsenal.com"
        # result.data[0].snippet = "The official Arsenal FC website..."

        # Convert to our format
        if result and result.data and len(result.data) > 0:
            first_result = result.data[0]

            return {
                "status": "success",
                "query": query,
                "engine": engine,
                "results": [
                    {
                        "position": i + 1,
                        "title": first_result.title,
                        "url": first_result.url,  # ← Extract URL
                        "snippet": getattr(first_result, 'description', '')
                    }
                    for i, first_result in enumerate(result.data)
                ]
            }

        else:
            return {
                "status": "error",
                "error": "No results found",
                "query": query
            }

    except Exception as e:
        logger.error(f"BrightData search failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "query": query
        }
```

**What Actually Happens**:

```python
# When we call:
result = await brightdata_client.search_engine(
    query='"Arsenal FC" official website',
    engine='google',
    num_results=1
)

# BrightData SDK makes HTTP request to BrightData servers:
# POST https://api.brightdata.com/serp/google
# Headers: { "Authorization": "Bearer <token>" }
# Body: { "query": "\"Arsenal FC\" official website", "num": 1 }

# BrightData servers:
# 1. Receive request
# 2. Execute Google search (with proxy rotation, anti-bot protection)
# 3. Parse SERP (Search Engine Results Page)
# 4. Return structured JSON

# Response:
# {
#     "status": "success",
#     "results": [
#         {
#             "position": 1,
#             "title": "Arsenal FC's Official Website",
#             "url": "https://www.arsenal.com"
#         }
#     ]
# }
```

---

### Step 5: BrightData Scrape API Call

**File**: `backend/brightdata_sdk_client.py` (lines 189-261)

```python
async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
    """
    Scrape URL and return markdown content

    This makes an HTTP request to BrightData's servers,
    which then scrape the URL and return clean markdown.

    Args:
        url: URL to scrape

    Returns:
        Markdown content
    """

    try:
        logger.info(f"🌐 Scraping: {url}")

        # Get BrightData SDK client
        client = await self._get_client()

        # Call BrightData SDK (which makes HTTP request to BrightData servers)
        result = await client.scrape.markdown(
            url=url  # "https://www.arsenal.com"
        )

        # Result structure:
        # result.data.content = "<markdown content>"

        # Convert to our format
        if result and result.data:
            return {
                "status": "success",
                "url": url,
                "content": result.data.content,  # ← Markdown content
                "word_count": len(result.data.content.split())
            }

        else:
            return {
                "status": "error",
                "error": "Scraping failed",
                "url": url
            }

    except Exception as e:
        logger.error(f"Scraping failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "url": url
        }
```

**What Actually Happens**:

```python
# When we call:
result = await brightdata_client.scrape_as_markdown(
    url="https://www.arsenal.com"
)

# BrightData SDK makes HTTP request:
# POST https://api.brightdata.com/scrape/markdown
# Headers: { "Authorization": "Bearer <token>" }
# Body: { "url": "https://www.arsenal.com" }

# BrightData servers:
# 1. Receive request
# 2. Navigate to URL (with proxy rotation, anti-bot)
# 3. Extract HTML
# 4. Convert to Markdown (using Readability algorithm)
# 5. Return structured JSON

# Response:
# {
#     "status": "success",
#     "url": "https://www.arsenal.com",
#     "content": "# Arsenal FC\n\n## Digital Transformation\n\nArsenal FC is..."
# }
```

---

### Step 6: Claude Evaluates Scraped Content

**File**: `backend/hypothesis_driven_discovery.py` (lines 925-1050)

```python
async def _evaluate_content_with_claude(
    self,
    content: str,
    hypothesis,
    hop_type: HopType
) -> Dict[str, Any]:
    """
    Evaluate scraped content with Claude

    Process:
    1. Build evaluation context (hypothesis, channel, history)
    2. Match MCP patterns (fast evidence detection)
    3. Build comprehensive prompt
    4. Call Claude (Haiku/Sonnet/Opus based on complexity)
    5. Extract decision and confidence delta
    """

    # Step 1: Build structured evaluation context
    context = EvaluationContext(
        hypothesis_statement=hypothesis.statement,
        hypothesis_category=hypothesis.category,
        current_confidence=hypothesis.confidence,
        iterations_attempted=hypothesis.iterations_attempted,
        hop_type=hop_type,
        channel_guidance=CHANNEL_EVALUATION_GUIDANCE[hop_type]
    )

    # Step 2: MCP pattern matching (existing logic)
    from taxonomy.mcp_evidence_patterns import match_evidence_type

    mcp_matches = match_evidence_type(content, extract_metadata=True)

    # MCP finds:
    # [
    #     {"type": "JOB_POSTING", "signal": "React Developer", "confidence": 0.75},
    #     {"type": "TECH_STACK", "signal": "React Native", "confidence": 0.60}
    # ]

    # Step 3: Build prompt
    prompt = f"""
# Hypothesis-Driven Discovery Evaluation

You are evaluating whether {context.entity_name} shows procurement readiness signals.

## Hypothesis Context
**Statement**: {context.hypothesis_statement}
**Category**: {context.hypothesis_category}
**Current Confidence**: {context.current_confidence:.2f}

## Channel Context: {context.hop_type.value.upper()}
{context.channel_guidance}

## Content to Evaluate
```markdown
{content[:2000]}
```

## MCP Pattern Matching Results
- **JOB_POSTING**: React Developer (+0.75)
- **TECH_STACK**: React Native (+0.60)

## Task
Evaluate the evidence and return a decision:
- ACCEPT: Strong procurement signal (+0.06)
- WEAK_ACCEPT: Capability signal (+0.02)
- REJECT: Evidence contradicts (-0.02)
- NO_PROGRESS: No relevant evidence (0.00)

Provide your decision with reasoning.
"""

    # Step 4: Call Claude (model selection based on content complexity)
    model = self._choose_evaluation_model(context)

    claude_response = await self.claude_client.messages.create(
        model=self.model_registry.get_model(model).model_id,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    # Step 5: Extract decision
    response_text = claude_response.content[0].text

    decision = extract_decision(response_text)  # Parse "ACCEPT", "WEAK_ACCEPT", etc.
    confidence_delta = extract_delta(response_text)  # Parse "+0.06"
    reasoning = extract_reasoning(response_text)  # Parse explanation

    return {
        "decision": decision,  # "ACCEPT"
        "confidence_delta": confidence_delta,  # +0.06
        "reasoning": reasoning,
        "evidence_found": response_text[:500],
        "model_used": model
    }
```

**Claude's Response**:

```json
{
    "decision": "ACCEPT",
    "confidence_delta": 0.06,
    "reasoning": "Found 'React Developer' job posting on careers page, which strongly indicates mobile app development procurement. The posting specifically mentions React Native experience required, matching the hypothesis category.",
    "model_used": "haiku"
}
```

---

### Step 7: Update Hypothesis State

**File**: `backend/hypothesis_manager.py`

```python
async def update_hypothesis(
    self,
    hypothesis_id: str,
    decision: str,
    confidence_delta: float,
    evidence: Dict[str, Any]
):
    """
    Update hypothesis state after iteration

    Process:
    1. Find hypothesis by ID
    2. Apply confidence delta
    3. Update counters
    4. Check lifecycle state transitions
    5. Save to FalkorDB (persistence)
    """

    hypothesis = self.get_hypothesis(hypothesis_id)

    # Update confidence
    old_confidence = hypothesis.confidence
    hypothesis.confidence = max(0.0, min(1.0, hypothesis.confidence + confidence_delta))
    hypothesis.last_delta = confidence_delta

    # Update counters
    hypothesis.iterations_attempted += 1

    if decision == "ACCEPT":
        hypothesis.iterations_accepted += 1
        hypothesis.reinforced_count += 1
    elif decision == "WEAK_ACCEPT":
        hypothesis.iterations_weak_accept += 1
    elif decision == "REJECT":
        hypothesis.iterations_rejected += 1
        hypothesis.weakened_count += 1
    elif decision == "NO_PROGRESS":
        hypothesis.iterations_no_progress += 1

    # Check lifecycle transitions
    if hypothesis.iterations_accepted >= 2 and hypothesis.confidence >= 0.70:
        hypothesis.status = "PROMOTED"
        hypothesis.promoted_at = datetime.now(timezone.utc)
    elif hypothesis.iterations_rejected >= 2 and hypothesis.confidence < 0.30:
        hypothesis.status = "DEGRADED"
        hypothesis.degraded_at = datetime.now(timezone.utc)

    # Store evidence
    if 'evidence_found' in evidence:
        hypothesis.metadata['evidence'].append({
            'iteration': hypothesis.iterations_attempted,
            'decision': decision,
            'content': evidence['evidence_found'][:500],
            'timestamp': datetime.now(timezone.utc).isoformat()
        })

    # Save to FalkorDB
    await self._save_hypothesis_to_falkordb(hypothesis)

    logger.info(
        f"Updated hypothesis {hypothesis_id}: "
        f"{old_confidence:.2f} → {hypothesis.confidence:.2f} "
        f"({decision}, delta={confidence_delta:+.2f})"
    )
```

**Result**:

```python
# Before:
hypothesis.confidence = 0.56
hypothesis.iterations_attempted = 3
hypothesis.iterations_accepted = 1

# After ACCEPT decision:
hypothesis.confidence = 0.62  # 0.56 + 0.06
hypothesis.iterations_attempted = 4
hypothesis.iterations_accepted = 2
hypothesis.status = "PROMOTED"  # 2 ACCEPTs + confidence >= 0.70
```

---

## Complete End-to-End Example

### Iteration 1

```python
# Initial state
hypothesis = Hypothesis(
    hypothesis_id="arsenal_react_mobile",
    category="Mobile Development",
    statement="Arsenal FC seeking React Native mobile app development",
    confidence=0.50,
    expected_information_gain=0.50
)

# Step 1: Calculate EIG
eig = (1 - 0.50) × 0.8 × 1.2 = 0.48

# Step 2: Choose hop type (MCP-guided)
best_hop = _choose_next_hop(hypothesis, state)
# Score: PRESS_RELEASE (0.10 × 0.48 = 0.048)
#       TECH_NEWS (0.25 × 0.48 = 0.12) ← Winner!
#       CAREERS_PAGE (0.08 × 0.48 = 0.038)
# Result: HopType.OFFICIAL_SITE

# Step 3: Generate search query
query = primary_queries[HopType.OFFICIAL_SITE]
# Query: '"Arsenal FC" official website'

# Step 4: Search Google (via BrightData)
search_result = await brightdata_client.search_engine(
    query='"Arsenal FC" official website',
    engine='google',
    num_results=1
)
# Returns: { "status": "success", "results": [{"url": "https://www.arsenal.com"}] }

# Step 5: Scrape URL (via BrightData)
scrape_result = await brightdata_client.scrape_as_markdown(
    url="https://www.arsenal.com"
)
# Returns: { "status": "success", "content": "# Arsenal FC\n\n## Digital Transformation\n\nWe are hiring..." }

# Step 6: Evaluate with Claude
evaluation = await _evaluate_content_with_claude(
    content=scrape_result['content'],
    hypothesis=hypothesis,
    hop_type=HopType.OFFICIAL_SITE
)
# Returns: { "decision": "ACCEPT", "confidence_delta": +0.06, "reasoning": "Found React Developer job posting..." }

# Step 7: Update hypothesis
await hypothesis_manager.update_hypothesis(
    hypothesis_id="arsenal_react_mobile",
    decision="ACCEPT",
    confidence_delta=+0.06,
    evidence=evaluation
)
# Result: hypothesis.confidence = 0.56
```

### Iteration 2 (Adaptive!)

```python
# Updated state
hypothesis.confidence = 0.56
hypothesis.iterations_attempted = 1
hypothesis.iterations_accepted = 1

# Recalculate EIG (lower confidence = lower EIG)
eig = (1 - 0.56) × 0.8 × 1.2 = 0.42  # Down from 0.48

# Choose hop type (MCP-guided with failure tracking)
best_hop = _choose_next_hop(hypothesis, state)

# Check failure tracking
# If OFFICIAL_SITE failed twice, skip it
if state.hop_failure_counts.get("OFFICIAL_SITE", 0) >= 2:
    logger.info("Skipping OFFICIAL_SITE (failed twice)")
    # Try other hop types instead

# Score hop types (avoiding failed ones)
# Score: PARTNERSHIP (0.35 × 0.42 = 0.147) ← Winner! (higher ROI than tech news now)
#        TECH_NEWS (0.25 × 0.42 = 0.105)
#        CAREERS_PAGE (0.08 × 0.42 = 0.034)

# Result: HopType.PRESS_RELEASE (mapped to PARTNERSHIP)

# Generate search query
query = primary_queries[HopType.PRESS_RELEASE]
# Query: '"Arsenal FC" recent news press release'

# Search Google
search_result = await brightdata_client.search_engine(
    query='"Arsenal FC" recent news press release',
    engine='google',
    num_results=1
)
# Returns: { "url": "https://www.techfootball.com/arsenal-partners-react-mobile" }

# Scrape URL
scrape_result = await brightdata_client.scrape_as_markdown(
    url="https://www.techfootball.com/arsenal-partners-react-mobile"
)
# Returns: { "content": "Arsenal FC announces partnership with React Mobile for fan app..." }

# Evaluate with Claude
evaluation = await _evaluate_content_with_claude(...)
# Returns: { "decision": "ACCEPT", "confidence_delta": +0.06, "reasoning": "Partnership announcement confirms mobile app procurement..." }

# Update hypothesis
# Result: hypothesis.confidence = 0.62
```

---

## Summary: The Complete Chain

```
┌──────────────────────────────────────────────────────────────┐
│ 1. HYPOTHESIS WITH EIG                                        │
│    hypothesis.confidence = 0.50                            │
│    hypothesis.EIG = 0.48 (calculated)                      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. MCP-GUIDED HOP SELECTION                                │
│    Score = Channel_ROI × EIG                                │
│    PRESS_RELEASE: 0.10 × 0.48 = 0.048                      │
│    TECH_NEWS: 0.25 × 0.48 = 0.12 ← WINNER!                  │
│    CAREERS_PAGE: 0.08 × 0.48 = 0.038                       │
│                                                              │
│    Result: HopType.OFFICIAL_SITE (uses tech news strategy)  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. SEARCH QUERY GENERATION                                 │
│    hop_type → primary_query                                 │
│    OFFICIAL_SITE → '"Arsenal FC" official website'           │
│                                                              │
│    This becomes a Google search:                            │
│    https://www.google.com/search?q="Arsenal%20FC"%20official │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. BRIGHTDATA SEARCH API (HTTP REQUEST)                     │
│    POST https://api.brightdata.com/serp/google              │
│    Headers: { "Authorization": "Bearer <token>" }            │
│    Body: { "query": "\"Arsenal FC\" official website" }      │
│                                                              │
│    BrightData servers execute Google search and return:    │
│    {                                                          │
│      "results": [{                                          │
│        "url": "https://www.arsenal.com"                     │
│      }]                                                      │
│    }                                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. BRIGHTDATA SCRAPE API (HTTP REQUEST)                     │
│    POST https://api.brightdata.com/scrape/markdown          │
│    Headers: { "Authorization": "Bearer <token>" }            │
│    Body: { "url": "https://www.arsenal.com" }               │
│                                                              │
│    BrightData servers:                                      │
│    - Navigate to URL (with proxy rotation)                   │
│    - Extract HTML                                             │
│    - Convert to Markdown                                     │
│    - Return JSON:                                            │
│    {                                                          │
│      "content": "# Arsenal FC\n\n## Digital Transformation..."│
│    }                                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. CLAUDE EVALUATION (MODEL CASCADE)                        │
│    Content: 2000 tokens from scraped markdown                 │
│    Model: Haiku (fast, $0.25/M)                             │
│    Prompt: "Evaluate evidence for procurement readiness..."   │
│                                                              │
│    Claude analyzes:                                          │
│    - MCP pattern matching (fast)                              │
│    - Contextual reasoning (medium)                            │
│    - Decision generation (fast)                               │
│                                                              │
│    Returns:                                                   │
│    {                                                          │
│      "decision": "ACCEPT",                                   │
│      "confidence_delta": +0.06,                              │
│      "reasoning": "Found React Developer job posting..."      │
│    }                                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. HYPOTHESIS UPDATE                                         │
│    confidence = 0.50 + 0.06 = 0.56                           │
│    iterations_attempted = 1                                 │
│    iterations_accepted = 1                                   │
│    evidence.append({                                         │
│      "iteration": 1,                                         │
│      "url": "https://www.arsenal.com",                       │
│      "decision": "ACCEPT",                                   │
│      "timestamp": "2025-12-01T10:00:00Z"                     │
│    })                                                        │
│                                                              │
│    Result: Hypothesis strengthened!                           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼ (REPEAT)

NEXT ITERATION:
- Recalculate EIG (0.48 → 0.42, lower due to higher confidence)
- Choose new hop type (avoid failed ones, prioritize high ROI)
- Generate new search query
- Scrape new URL
- Evaluate new content
- Update hypothesis again

... and so on for up to 30 iterations or until saturation.
```

---

## Key Takeaways

### ✅ How EIG Affects Scraping

1. **EIG Score**: Higher EIG = higher priority hop types
   - High EIG (0.48) → High ROI channels (partnership announcements: 0.35)
   - Low EIG (0.10) → Low ROI channels (LinkedIn jobs: 0.01)

2. **Channel Selection**: `Score = Channel_ROI × EIG`
   - Partnership: `0.35 × 0.48 = 0.168` (high)
   - LinkedIn Jobs: `0.01 × 0.48 = 0.005` (low)

3. **Hop Type → Search Query**: Each hop type maps to specific Google search
   - `PARTNERSHIP` → `"Arsenal FC" partnership announcement`
   - `CAREERS` → `"Arsenal FC" careers jobs`

4. **Search Query → URL**: Google search returns first result
   - `"Arsenal FC" partnership announcement` → `https://partnershiphub.com/arsenal-react`

5. **URL → Content**: BrightData scrapes URL and returns markdown
   - `https://partnershiphub.com/arsenal-react` → `## Arsenal React Partnership...`

### ✅ Adaptive Optimizations

1. **Failure Tracking**: Skip hop types that fail 2+ times
2. **Blacklisting**: Avoid URLs with blacklisted patterns (e.g., "consumer products")
3. **Temporal Context**: Prefer fresh evidence (<6 months gets +0.15 bonus)
4. **Network Context**: If 3 partners use React, boost React hypotheses by 1.15×
5. **Multi-Pass Evolution**: Each pass generates new hypotheses from discoveries

### ✅ The Feedback Loop

```
Evidence Collected → Claude Evaluates → Confidence Updated → EIG Recalculated
                                                                  ↑
                                                                  │
                        ←←←←←←←←←←←←←←←←← Hop Selection Adapted ←←←←←←←←←←←←←
                                                                  │
                         EIG Determines Where to Scrape Next
```

**The Result**: An intelligent, adaptive scraping system that **learns from each iteration** and optimizes where to look next! 🎯
