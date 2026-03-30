# Hypothesis Seeding Strategy Analysis

**Date**: 2026-02-03  
**Question**: Are we seeding hypotheses optimally for procurement signal detection?

---

## Current Approach

### 1. Template-Based Hypothesis Seeding

**How it Works**:
1. **Load Template**: 73 production templates from JSON (e.g., `tier_1_club_centralized_procurement`)
2. **Match Entity**: Template matched by sport, org_type, revenue_band, digital_maturity
3. **Extract Patterns**: 3 signal patterns per template (e.g., "Strategic Leadership Hire")
4. **Create Hypotheses**: Each pattern becomes a hypothesis with:
   - Statement: "Bayern Munich is preparing procurement related to Strategic Leadership Hire"
   - Prior probability: 0.5 (from pattern weight)
   - Initial confidence: 0.5
   - Category: From template

**Example Hypothesis**:
```
Entity: Bayern Munich
Template: tier_1_club_centralized_procurement
Pattern: Strategic Leadership Hire
Statement: "Bayern Munich is preparing procurement related to Strategic Leadership Hire"
Early Indicators: Job posting: 'Director of Digital', Job posting: 'Head of CRM'
```

### 2. Sequential Hop Exploration

**Hop Strategy** (single-hop per iteration):
1. **Select Hypothesis**: EIG (Expected Information Gain) prioritizes uncertain + valuable
2. **Select Hop Type**: MCP-guided selection from allowed channels
3. **Scrape Content**: BrightData SDK with fallbacks
4. **Evaluate with Claude**:
   - Prompt: "Evaluate this scraped content for hypothesis: {statement}"
   - Context: Content from {hop_type}
   - Task: "Determine if this content supports or contradicts the hypothesis"
   - Returns: ACCEPT, WEAK_ACCEPT, REJECT, NO_PROGRESS

**Hop Types Available**:
- `OFFICIAL_SITE`: Official domain, homepage
- `CAREERS_PAGE`: Jobs index, job postings
- `LINKEDIN_JOB`: Specific LinkedIn job
- `ANNUAL_REPORT`: Financial section
- `PRESS_RELEASE`: Recent news

### 3. Evaluation Questions

**What We Ask Claude**:
```
Task: Determine if this content supports or contradicts the hypothesis.

Return JSON:
{
  "decision": "ACCEPT" | "WEAK_ACCEPT" | "REJECT" | "NO_PROGRESS",
  "confidence_delta": 0.0,
  "justification": "brief explanation",
  "evidence_found": "key evidence excerpt",
  "evidence_type": "mcp_evidence_type_or_null"
}
```

**Content Limitation**: First 2000 characters of scraped content

---

## Strengths of Current Approach ✅

### 1. **Deterministic & Scalable**
- No LLM calls needed for entity/hypothesis matching
- Templates pre-defined with domain expertise
- Fast and consistent

### 2. **EIG-Based Prioritization**
- Focuses exploration on uncertain + valuable hypotheses
- Balances exploration vs exploitation
- Adapts based on discovered evidence

### 3. **Multi-Channel Coverage**
- Explores 5 different signal channels
- Prevents over-exploration of single channel
- Graceful fallbacks when searches fail

### 4. **Cost Control**
- Single-hop per iteration (predictable cost)
- Content truncation (2000 chars) limits token usage
- Max depth and iteration limits

---

## Potential Issues & Improvements ⚠️

### Issue 1: Generic Evaluation Prompt

**Current Problem**:
```
Task: Determine if this content supports or contradicts the hypothesis.
```
- Too generic
- Doesn't specify what to look for
- Doesn't leverage early indicators

**Example**:
```
Hypothesis: "Bayern Munich is preparing procurement related to Strategic Leadership Hire"
Content scraped: Bayern FC official website
Question: "Does this support or contradict the hypothesis?"
```

**Better Approach**:
```
Task: You are analyzing procurement signals for Bayern Munich.

Hypothesis: "Bayern Munich is preparing procurement related to Strategic Leadership Hire"

Look for SPECIFIC evidence:
1. Job postings or career pages mentioning leadership roles (Director of Digital, Head of CRM)
2. News about organizational changes or restructuring
3. Technology stack mentions (Salesforce, CRM, digital transformation initiatives)
4. Budget allocations or department expansions

Does this content contain SPECIFIC evidence of procurement intent?
- If yes: Return ACCEPT with exact quote
- If no: Return REJECT with explanation
- If unclear: Return NO_PROGRESS
```

**Impact**: Would improve precision and reduce NO_PROGRESS decisions

---

### Issue 2: Limited Content Context

**Current Problem**:
- Only first 2000 characters evaluated
- May miss relevant evidence deeper in page
- Loss of context for large pages

**Example**:
- Careers page with 50 job postings
- Only first 3-4 jobs evaluated
- Might miss the specific role we're looking for

**Better Approach**:
1. **Semantic Search**: Use embeddings to find most relevant sections
2. **Keyword Filtering**: Search for hypothesis-specific terms before evaluation
3. **Section Extraction**: Extract only relevant sections (not full page)

```python
# Pseudo-code
relevant_sections = find_relevant_sections(
    content=huge_page,
    keywords=["Director", "Digital", "CRM", "Salesforce", "Leadership"]
)
# Evaluate only top 3 most relevant sections
```

**Impact**: Would find signals more accurately in large pages

---

### Issue 3: Static Hop Selection

**Current Problem**:
- Hop types selected in predetermined order
- Doesn't adapt to what we've already found
- Might explore same channel multiple times

**Example**:
```
Iteration 1: OFFICIAL_SITE → NO_PROGRESS
Iteration 2: OFFICIAL_SITE again (different depth level)
```

**Better Approach**:
1. **Channel Blacklist**: Skip channels that failed consecutively
2. **Adaptive Hop Selection**: Prioritize channels not yet explored
3. **Smart Routing**: If careers page has ACCEPT, focus more there

**Impact**: Would reduce redundant exploration

---

### Issue 4: Hypothesis Statement Too Generic

**Current Problem**:
```
"Bayern Munich is preparing procurement related to Strategic Leadership Hire"
```
- Very broad
- Multiple interpretations possible
- Hard to verify with web content

**Better Approach**:
```
Specific Signal to Look For:
- Job posting for "Director of Digital" or "Head of CRM"
- Recent hire in similar role (6 months)
- Technology stack changes (new CRM system mentioned)
- Budget increase for digital department

Acceptance Criteria:
- CONFIRMED: Exact job posting found with title and date
- STRONG: Multiple related roles or recent hire
- WEAK: Department expansion or technology mentioned
- REJECT: No evidence or contradictory evidence (e.g., layoffs)
```

**Impact**: Would improve evaluation accuracy and confidence calibration

---

### Issue 5: No Temporal Context

**Current Problem**:
- Doesn't consider WHEN evidence was found
- Old job postings (2+ years) treated same as recent
- Can't detect trends over time

**Better Approach**:
```
Temporal Analysis:
- If evidence found within 3 months → HIGH confidence
- If evidence found 3-6 months ago → MEDIUM confidence
- If evidence found 6-12 months ago → LOW confidence
- If evidence >12 months old → IGNORE (too stale)

Seasonality:
- Look for hiring cycles (e.g., "Director of Digital" more common in Jan/Feb)
- Budget cycles (Q1 vs Q4)
- Transfer windows (sports-specific)
```

**Impact**: Would improve signal quality and reduce false positives

---

## Recommendations

### Priority 1: Improve Evaluation Prompt (HIGH Impact, Low Effort)

**Current**:
```python
prompt = f"""
Evaluate this scraped content for hypothesis: {hypothesis.statement}

Content from {hop_type.value}:
{content[:2000]}
Task: Determine if this content supports or contradicts the hypothesis.
```

**Improved**:
```python
prompt = f"""
You are a procurement signal analyst for {entity_name}.

SPECIFIC HYPOTHESIS: {hypothesis.statement}

SIGNAL TO LOOK FOR: {hypothesis.metadata.get('early_indicators', [])}

EVALUATION CRITERIA:
1. ACCEPT: Direct evidence found (exact job posting, recent hire, specific role)
2. WEAK_ACCEPT: Indirect evidence (department expansion, tech stack mentioned)
3. REJECT: Contradictory evidence (layoffs, downsizing)
4. NO_PROGRESS: No relevant information

Content from {hop_type.value}:
{content[:2000]}

Analyze this content and provide:
- Specific evidence found (quote exact text)
- Date/timestamp if available
- Decision based on criteria above
```

**Expected Impact**: +30-50% improvement in signal accuracy

---

### Priority 2: Context-Aware Content Filtering (HIGH Impact, Medium Effort)

**Approach**:
1. **Keyword Extraction**: Get keywords from hypothesis early indicators
2. **Semantic Search**: Use embeddings to find relevant sections
3. **Targeted Evaluation**: Only evaluate most relevant sections

**Pseudo-code**:
```python
# Extract keywords from hypothesis
keywords = extract_keywords(hypothesis.statement)
# ["Director", "Digital", "CRM", "Salesforce"]

# Find relevant sections
sections = find_relevant_sections(content, keywords, top_n=3)

# Evaluate each section
for section in sections:
    evaluation = evaluate_section(section, hypothesis)
    if evaluation.decision == "ACCEPT":
        return evaluation  # Early exit on strong signal
```

**Expected Impact**: +20-40% improvement in detection rate

---

### Priority 3: Adaptive Hop Selection (MEDIUM Impact, Low Effort)

**Current**: Predetermined hop order  
**Improved**: Skip failed channels, prioritize unexplored

```python
# Track which channels have evidence per hypothesis
channel_evidence = {
    "liverpool-fc_strategic_leadership_hire": {
        "official_site": "NO_PROGRESS",
        "careers_page": "ACCEPT"  # Has evidence!
    }
}

# Prioritize careers_page for next hop
```

**Expected Impact**: +15-25% reduction in redundant exploration

---

### Priority 4: Temporal Analysis (HIGH Impact, High Effort)

**Approach**:
1. Extract dates from scraped content
2. Apply decay function based on evidence age
3. Weight recent evidence more heavily

```python
# Age-based confidence adjustment
if evidence_age < 3 months:
    multiplier = 1.0
elif evidence_age < 6 months:
    multiplier = 0.7
elif evidence_age < 12 months:
    multiplier = 0.4
else:
    multiplier = 0.0  # Too stale, ignore

confidence_delta *= multiplier
```

**Expected Impact**: +40-60% improvement in signal quality

---

### Priority 5: Hypothesis Refinement (MEDIUM Impact, Medium Effort)

**Current**: Generic hypothesis statements  
**Improved**: Specific, verifiable statements

**Before**:
```
"Bayern Munich is preparing procurement related to Strategic Leadership Hire"
```

**After**:
```
"Bayern Munich is actively recruiting for: Director of Digital, Head of CRM, 
or similar strategic leadership role (as of: last 3 months)"
```

**Expected Impact**: +25-35% improvement in evaluation consistency

---

## Is Our Approach Optimal?

### Current Approach: 6/10

**Strengths** ✅:
- Deterministic and scalable
- EIG-based prioritization works well
- Multi-channel coverage
- Cost-effective

**Weaknesses** ❌:
- Generic evaluation prompt (too open-ended)
- Limited content context (2000 char limit)
- No temporal filtering
- Static hop selection
- Generic hypothesis statements

### With All Improvements: 9/10

**Would Be Optimal If**:
- ✅ Evaluation prompts are specific and targeted
- ✅ Content filtering focuses on relevant sections
- ✅ Hop selection adapts to evidence found
- ✅ Temporal analysis filters stale signals
- ✅ Hypothesis statements are verifiable

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 hours)
1. **Improve evaluation prompt** - Update `_evaluate_content_with_claude()`
2. **Add acceptance criteria** - Define what counts as ACCEPT vs WEAK_ACCEPT
3. **Extract evidence snippets** - Return exact quotes in evaluation

### Phase 2: Context Enhancement (2-3 hours)
1. **Semantic search** - Find relevant sections in large pages
2. **Keyword filtering** - Pre-filter content before evaluation
3. **Targeted evaluation** - Only evaluate most relevant sections

### Phase 3: Adaptive Strategy (3-4 hours)
1. **Channel evidence tracking** - Remember which channels have evidence
2. **Adaptive hop selection** - Prioritize channels with evidence
3. **Temporal decay** - Down-weight old evidence

### Phase 4: Hypothesis Refinement (2-3 hours)
1. **More specific statements** - Include timeframe and specifics
2. **Acceptance criteria** - Define clear verification rules
3. **Confidence calibration** - Better baseline probabilities

---

## Conclusion

**Current approach is GOOD but not OPTIMAL.**

We're:
- ✅ Asking the right general questions (exploration strategy is solid)
- ❌ Not asking specific enough questions during evaluation
- ❌ Not leveraging temporal information
- ❌ Not adapting exploration based on findings

**Biggest Gains** from:
1. **Better evaluation prompts** (+30-50% signal accuracy)
2. **Temporal filtering** (+40-60% signal quality)
3. **Context-aware content filtering** (+20-40% detection rate)

**Estimated Overall Improvement**: +100-200% signal quality improvement

---

**Recommendation**: Implement Priority 1 & 2 first (quick wins), then assess if Priority 3-5 are needed based on results.

