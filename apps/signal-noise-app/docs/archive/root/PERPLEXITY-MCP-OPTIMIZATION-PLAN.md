# 🧠 Perplexity MCP Optimization Plan

**Current Status:** Underutilized (1 generic call per batch)  
**Potential:** Strategic intelligence layer + real-time validation  
**Impact:** 3-5x improvement in lead quality and competitive intelligence

---

## 📊 Current Perplexity Usage Analysis

### **What's Happening Now** ⚠️

```bash
# Current approach (run-rfp-monitor.sh, line 334):
3. Once all entities processed:
   Perform one Perplexity MCP (perplexity-mcp) pass to validate and re-score results.
```

**Problems:**
1. ❌ Single generic call per 300-entity batch (inefficient)
2. ❌ Called AFTER BrightData (misses opportunity for targeted search)
3. ❌ Generic query: "Research X for digital transformation..." (too broad)
4. ❌ No specific validation tasks (URL check, deadline extraction)
5. ❌ Results mixed with BrightData output (lost intelligence value)
6. ❌ No competitive intelligence gathering
7. ❌ Not leveraging Perplexity's real-time web advantage

### **Perplexity's Unique Capabilities** ✨

| Capability | Current Usage | Potential Usage |
|------------|---------------|-----------------|
| **Real-time web search** | 0% | 100% - Verify live RFPs |
| **Natural language Q&A** | 10% | 100% - Extract specific facts |
| **Source citations** | 0% | 100% - Validate URLs |
| **Reasoning/Analysis** | 20% | 100% - Competitive intelligence |
| **Fact extraction** | 0% | 100% - Deadlines, budgets |
| **Contextual understanding** | 30% | 100% - Entity maturity assessment |

**Cost:** ~$0.001 per query (1,000 queries = $1)  
**Value:** High-quality validated leads worth $$$

---

## 🎯 Proposed Perplexity Usage Strategy

### **Phase 1: Real-time RFP Validation (Per Entity)**

Instead of one batch-level call, use Perplexity for **targeted validation** of detected opportunities.

#### **A. Active RFP Verification**

**When to use:** After BrightData finds potential RFP  
**Purpose:** Validate if RFP is still open and extract key details  
**Cost:** ~$0.001 per validation

```javascript
// Perplexity Query Template
const rfpValidationQuery = `
Check if ${organization} has an active RFP or tender for ${project_type}.

Specific questions:
1. Is there a current open RFP/tender for this project?
2. What is the exact submission deadline (provide date)?
3. What is the official RFP document URL or submission portal?
4. Has a vendor already been selected (if so, who and when)?
5. What is the estimated project budget or contract value?

Requirements:
- Only provide information from sources dated within the last 6 months
- Include source URLs for all facts
- If RFP is closed or awarded, state this explicitly
`;

// Expected Response
{
  "is_active": true,
  "deadline": "2025-03-03",
  "submission_url": "https://cricketwestindies.org/tenders/digital-2025",
  "status": "OPEN",
  "budget": "£200K-£500K",
  "sources": [
    "https://linkedin.com/posts/cwi...",
    "https://cricketwestindies.org/procurement"
  ]
}
```

**Integration Point:** `run-rfp-monitor.sh` line 327-331

```bash
2. For each entity:
   a. Print progress: [ENTITY-START] <index> <organization_name>
   
   b. BrightData Search (Phase 1 - Quick Discovery):
      - Query for RFP indicators
      - If potential RFP found → Store as "UNVERIFIED"
   
   c. Perplexity Validation (Phase 2 - Smart Verification):
      IF BrightData found potential RFP:
        - Query Perplexity with specific validation questions
        - Extract: deadline, budget, submission URL, status
        - Verify URL is real (not placeholder)
        - Check if deadline is in future
        - Update confidence score based on validation
        - Mark as "VERIFIED" if passes all checks
```

---

### **Phase 2: Competitive Intelligence (Per High-Value Entity)**

**When to use:** For entities with fit_score >= 80  
**Purpose:** Understand competitive landscape and positioning  
**Cost:** ~$0.002 per entity (2x longer query)

```javascript
const competitiveIntelQuery = `
Analyze ${organization}'s digital technology landscape and procurement history:

1. Current Technology Stack:
   - What digital platforms/systems do they currently use?
   - Who are their existing technology partners?
   - What's their digital maturity level (1-5 scale)?

2. Recent Procurement History:
   - Which vendors have they worked with in last 2 years?
   - What was the typical project scale and budget?
   - Were there any failed implementations or partnerships?

3. Decision Makers:
   - Who leads digital transformation / technology procurement?
   - Recent hiring of CTO/CIO/CDO (signal of change)?
   - Key stakeholders mentioned in technology announcements?

4. Competitive Analysis:
   - Which vendors are currently being considered for digital projects?
   - Any recent partnership announcements with competitors?
   - What's Yellow Panther's competitive position?

5. Strategic Insights:
   - What are their stated digital priorities for 2025?
   - Budget allocation for technology initiatives?
   - Any red flags (litigation, financial issues, reputational problems)?

Provide factual information with source citations.
`;

// Expected Response
{
  "digital_maturity": "MEDIUM (3/5)",
  "current_partners": ["SAP", "AWS", "Salesforce"],
  "recent_projects": [
    {
      "vendor": "Accenture",
      "project": "Fan engagement platform",
      "year": 2023,
      "outcome": "SUCCESS"
    }
  ],
  "decision_makers": [
    {
      "name": "John Smith",
      "title": "CTO",
      "hired": "2024-06"
    }
  ],
  "competitors": ["Deloitte", "Publicis Sapient"],
  "yellow_panther_advantage": "Sports specialization + award-winning apps",
  "risks": [],
  "sources": [...]
}
```

**Integration Point:** New section in `run-rfp-monitor.sh` after line 335

```bash
3. Competitive Intelligence (for high-fit opportunities):
   
   FOR each entity with fit_score >= 80:
     a. Query Perplexity for competitive landscape
     b. Extract decision maker information
     c. Identify Yellow Panther positioning advantages
     d. Flag any competitive risks
     e. Add "competitive_intel" section to JSON output
```

---

### **Phase 3: Deadline & Budget Extraction (Batch-Level)**

**When to use:** For all detected RFPs missing deadline/budget  
**Purpose:** Extract specific facts using targeted queries  
**Cost:** ~$0.001 per query

```javascript
const extractDeadlineQuery = `
What is the submission deadline for ${organization}'s ${project_title} RFP/tender?

Requirements:
- Provide exact date in YYYY-MM-DD format
- Include source URL
- If extended, provide new deadline
- If closed, state when it closed
`;

const extractBudgetQuery = `
What is the budget or estimated value for ${organization}'s ${project_title}?

Check for:
- Official budget figures
- Estimated contract value
- Budget range or ceiling
- Multi-year total investment

Provide in currency with source.
`;
```

**Integration Point:** `run-rfp-monitor.sh` line 445+ (after JSON extraction)

```bash
# --- ENHANCE RESULTS WITH PERPLEXITY ---
echo "🧠 Enhancing results with Perplexity intelligence..." | tee -a "$LOG_DIR/test-cron.log"

# For each RFP missing deadline or budget, query Perplexity
MISSING_DEADLINE=$(jq -r '[.highlights[] | select(.deadline == null)] | length' "$CLEAN_FILE")

if [ "$MISSING_DEADLINE" -gt 0 ]; then
  echo "📅 Extracting $MISSING_DEADLINE missing deadlines via Perplexity..." | tee -a "$LOG_DIR/test-cron.log"
  
  # Call Claude with Perplexity MCP to extract missing data
  # Update $CLEAN_FILE with enhanced results
fi
```

---

### **Phase 4: Entity Pre-Qualification (Before Batch)**

**When to use:** Before processing each batch  
**Purpose:** Prioritize entities most likely to have active RFPs  
**Cost:** ~$0.001 per entity

```javascript
const preQualificationQuery = `
Is ${organization} currently engaging in any digital procurement or technology transformation?

Look for signals:
- Recent technology partnership announcements (last 3 months)
- Job postings for project managers or implementation roles
- New CTO/CIO/CDO appointments
- Digital strategy announcements
- Budget allocation for technology

Respond:
- YES with evidence and relevance score (1-10)
- NO if no recent digital activity
`;

// Response
{
  "pre_qualified": true,
  "relevance_score": 8,
  "signals": [
    "New CTO appointed June 2024",
    "LinkedIn post about digital transformation goals",
    "£2M budget allocated for technology in 2025"
  ],
  "recommendation": "HIGH_PRIORITY - Process immediately"
}
```

**Integration Point:** New pre-batch step in `run-rfp-batches.sh`

```bash
# Before running each batch:
1. Query Neo4j for 300 entities
2. Pre-qualify top 100 using Perplexity (parallel)
3. Sort by relevance_score (highest first)
4. Process high-relevance entities first
5. Skip low-relevance entities if time constrained
```

---

### **Phase 5: Source Verification (URL Validation)**

**When to use:** For all detected RFPs with URLs  
**Purpose:** Eliminate placeholder/fake URLs  
**Cost:** ~$0.0005 per check

```javascript
const urlVerificationQuery = `
Verify if this URL is legitimate and accessible: ${url}

Check:
1. Is this a real, accessible webpage (not placeholder/example)?
2. Does it contain RFP/tender information for ${organization}?
3. If it's a LinkedIn post, is it from the official organization account?
4. What is the publication date?
5. Is the content still relevant (not expired)?

Respond with validation status and alternative URLs if original is broken.
`;
```

**Integration Point:** `run-rfp-monitor.sh` line 460+ (JSON validation phase)

```bash
# --- URL VERIFICATION ---
for url in $(jq -r '.highlights[].src_link' "$CLEAN_FILE"); do
  if [[ "$url" == *"example.com"* ]]; then
    # Mark as INVALID
    continue
  fi
  
  # Quick Perplexity verification
  # Update validation_status field
done
```

---

### **Phase 6: Market Trend Analysis (Weekly)**

**When to use:** End of each weekly cycle  
**Purpose:** Identify emerging RFP patterns and opportunities  
**Cost:** ~$0.01 per weekly analysis

```javascript
const marketTrendQuery = `
Analyze digital transformation and technology procurement trends in the sports industry for ${week_period}:

1. Emerging RFP Categories:
   - Which types of digital projects are most common?
   - Any new technology areas gaining traction?

2. Active Organizations:
   - Which sports organizations are most active in procurement?
   - Any major upcoming RFPs announced?

3. Technology Trends:
   - What technologies are being prioritized (AI, mobile, analytics)?
   - Any industry-wide initiatives or mandates?

4. Competitive Landscape:
   - Which vendors won major contracts recently?
   - Any new market entrants to watch?

5. Yellow Panther Opportunities:
   - Specific recommendations for outreach
   - Gaps in market that YP can fill

Provide actionable insights with sources.
`;
```

**Integration Point:** New script `run-rfp-weekly-intelligence.sh`

---

## 🏗️ Implementation Architecture

### **Revised `run-rfp-monitor.sh` Flow**

```bash
┌─────────────────────────────────────────────────────────┐
│ 1. DISCOVERY (BrightData)                               │
│    - Fast keyword-based search                          │
│    - Identify potential RFPs (UNVERIFIED)               │
│    - ~300 entities × 1 query = 300 calls                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. VALIDATION (Perplexity)                              │
│    - Verify each detected RFP is active                 │
│    - Extract deadline, budget, submission URL           │
│    - Check URL legitimacy                               │
│    - ~50 detections × 1 query = 50 calls                │
│    Status: UNVERIFIED → VERIFIED or REJECTED            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. INTELLIGENCE (Perplexity - High-Value Only)          │
│    - Competitive landscape for fit_score >= 80          │
│    - Decision maker identification                      │
│    - Yellow Panther positioning analysis                │
│    - ~20 high-value × 1 query = 20 calls                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. ENRICHMENT (Perplexity - Missing Data)               │
│    - Extract missing deadlines                          │
│    - Extract missing budgets                            │
│    - Find alternative source URLs                       │
│    - ~15 incomplete × 1 query = 15 calls                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. OUTPUT                                                │
│    - Verified, enriched, intelligence-enhanced RFPs     │
│    - Ready for stakeholder review and outreach          │
└─────────────────────────────────────────────────────────┘

Total Perplexity Calls: ~85 per batch (vs. 1 currently)
Total Cost: ~$0.085 per batch (~$0.42 for 5 batches)
Value: 10-20 verified, high-quality leads with competitive intel
ROI: $$$$ (one won RFP pays for 10,000+ batches)
```

---

## 🔧 Detailed Implementation Steps

### **Step 1: Update `run-rfp-monitor.sh` Prompt (Priority: CRITICAL)**

**Replace lines 313-385 with:**

```bash
CLAUDE_TASK="
Follow this enhanced RFP detection workflow:

PHASE 1: DISCOVERY (BrightData)
--------------------------------
1. Query 300 entities from Neo4j MCP (neo4j-mcp):
   MATCH (e:Entity)
   WHERE e.type IN ['Club','League','Federation','Tournament']
   RETURN e.name, e.sport, e.country
   SKIP ${RANGE_START} LIMIT 300

2. For each entity:
   a. Print: [ENTITY-START] <index> <organization_name>
   
   b. BrightData Search (Quick Discovery):
      Query: <organization> + (\"RFP\" OR \"tender\" OR \"invitation to tender\" OR \"soliciting proposals\" OR \"digital transformation partner\")
      Time filter: Last 6 months
      
   c. If potential RFP found:
      Print: [ENTITY-DETECTED] <organization> (BrightData: <n> hits)
      Store as: {org, project_title, src_link, status: \"UNVERIFIED\"}
   
   d. If no RFP found:
      Print: [ENTITY-NONE] <organization>
      Continue to next entity.

PHASE 2: VALIDATION (Perplexity - Targeted)
--------------------------------------------
3. For each UNVERIFIED detection from Phase 1:
   
   a. Perplexity Validation Query:
      \"Is ${organization}'s ${project_title} RFP still open? Provide:
       1. Current status (OPEN/CLOSED/AWARDED)
       2. Exact deadline (YYYY-MM-DD format)
       3. Official submission URL (not example.com)
       4. Estimated budget or contract value
       5. Source URLs for verification\"
   
   b. Validate Response:
      - If URL contains \"example.com\" or \"placeholder\" → REJECT
      - If status = CLOSED or AWARDED → REJECT
      - If deadline is in past → REJECT
      - If deadline is missing and announcement > 6 months old → REJECT
      - If all checks pass → Mark as \"VERIFIED\"
   
   c. Extract Data:
      - deadline: <YYYY-MM-DD>
      - deadline_days_remaining: <int>
      - budget: \"<currency value>\" or \"Not specified\"
      - submission_url: <real URL>
      - source_quality: <0.0-1.0 based on source type>
   
   d. Print: [ENTITY-VERIFIED] <organization> (Deadline: <date>, Budget: <amount>)

PHASE 3: COMPETITIVE INTELLIGENCE (Perplexity - High-Value Only)
-----------------------------------------------------------------
4. For each VERIFIED opportunity with potential fit_score >= 80:
   
   a. Perplexity Competitive Intel Query:
      \"Analyze ${organization}'s digital landscape:
       1. Current technology partners
       2. Recent digital projects and vendors
       3. Decision makers (CTO/CIO/CDO)
       4. Competitors bidding on this opportunity
       5. Yellow Panther competitive positioning\"
   
   b. Extract Intelligence:
      - current_partners: [...]
      - recent_projects: [...]
      - decision_makers: [...]
      - competitors: [...]
      - yp_advantages: [...]
   
   c. Add to output: \"competitive_intel\": {...}

PHASE 4: STRUCTURED OUTPUT
---------------------------
5. Construct JSON with enhanced validation:
   {
     \"total_rfps_detected\": <int>,
     \"verified_rfps\": <int>,
     \"rejected_rfps\": <int>,
     \"entities_checked\": <int>,
     \"highlights\": [
       {
         \"organization\": \"<name>\",
         \"src_link\": \"<real URL, not example.com>\",
         \"source_type\": \"<linkedin|tender_portal|news|partnership>\",
         \"validation_status\": \"VERIFIED\",
         \"date_published\": \"<YYYY-MM-DD>\",
         \"deadline\": \"<YYYY-MM-DD>\",
         \"deadline_days_remaining\": <int>,
         \"budget\": \"<amount>\",
         \"summary_json\": {
           \"title\": \"<summary>\",
           \"confidence\": <0.0-1.0>,
           \"urgency\": \"<low|medium|high>\",
           \"fit_score\": <0-100>,
           \"source_quality\": <0.0-1.0>
         },
         \"perplexity_validation\": {
           \"verified_by_perplexity\": true,
           \"deadline_confirmed\": true,
           \"url_verified\": true,
           \"budget_estimated\": true
         },
         \"competitive_intel\": {
           \"current_partners\": [...],
           \"competitors\": [...],
           \"yp_advantages\": [...]
         }
       }
     ],
     \"scoring_summary\": {
       \"avg_confidence\": <float>,
       \"avg_fit_score\": <float>,
       \"top_opportunity\": \"<organization>\"
     },
     \"quality_metrics\": {
       \"brightdata_detections\": <int>,
       \"perplexity_verifications\": <int>,
       \"verified_rate\": <float>,
       \"placeholder_urls_rejected\": <int>,
       \"expired_rfps_rejected\": <int>
     }
   }

6. Write verified results to Supabase MCP (supabase) table 'rfp_opportunities'.

7. Return ONLY valid JSON (no markdown, no explanations).
"
```

### **Step 2: Update JSON Schema with Perplexity Fields**

**Enhanced output structure:**

```json
{
  "total_rfps_detected": 47,
  "verified_rfps": 23,
  "rejected_rfps": 24,
  "entities_checked": 300,
  "highlights": [
    {
      "organization": "Pakistan Cricket Board",
      "src_link": "https://www.pcb.com.pk/tenders",
      "source_type": "tender_portal",
      "validation_status": "VERIFIED",
      "date_published": "2025-01-15",
      "deadline": "2025-04-30",
      "deadline_days_remaining": 144,
      "budget": "£500K-£1M",
      "summary_json": {
        "title": "Website Development & PCB LIVE Streaming Platform",
        "confidence": 0.95,
        "urgency": "high",
        "fit_score": 95,
        "source_quality": 1.0
      },
      "perplexity_validation": {
        "verified_by_perplexity": true,
        "deadline_confirmed": true,
        "url_verified": true,
        "budget_estimated": true,
        "verification_timestamp": "2025-11-07T09:30:00Z",
        "verification_sources": [
          "https://www.pcb.com.pk/tenders",
          "https://linkedin.com/posts/pcb-official..."
        ]
      },
      "competitive_intel": {
        "digital_maturity": "MEDIUM (3/5)",
        "current_partners": ["IBM", "Oracle"],
        "recent_projects": [
          {
            "vendor": "Infosys",
            "project": "Fan engagement app",
            "year": 2023
          }
        ],
        "competitors": ["TCS", "Wipro", "Accenture"],
        "yp_advantages": [
          "Sports specialization",
          "Award-winning cricket apps (Premier Padel)",
          "ISO 27001 security certification"
        ],
        "decision_makers": [
          {
            "name": "Faisal Hasnain",
            "title": "Chief Operating Officer",
            "linkedin": "..."
          }
        ]
      }
    }
  ],
  "scoring_summary": {
    "avg_confidence": 0.87,
    "avg_fit_score": 78,
    "top_opportunity": "Pakistan Cricket Board"
  },
  "quality_metrics": {
    "brightdata_detections": 47,
    "perplexity_verifications": 47,
    "verified_rate": 0.49,
    "placeholder_urls_rejected": 24,
    "expired_rfps_rejected": 0,
    "missing_deadlines_extracted": 12,
    "competitive_intel_gathered": 8
  },
  "perplexity_usage": {
    "total_queries": 67,
    "validation_queries": 47,
    "competitive_intel_queries": 8,
    "data_extraction_queries": 12,
    "estimated_cost_usd": 0.067
  }
}
```

---

## 📈 Expected Impact

### **Quality Improvements**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Placeholder URLs** | ~30% | <5% | 6x reduction |
| **Verified Deadlines** | ~20% | >90% | 4.5x increase |
| **Budget Information** | ~10% | >60% | 6x increase |
| **Competitive Intel** | 0% | 100% (high-fit) | ∞ |
| **False Positives** | ~40% | <10% | 4x reduction |
| **Actionable Leads** | ~50/709 (7%) | ~120/400 (30%) | 4x improvement |

### **Cost Analysis**

**Per Batch (300 entities):**
- BrightData: 300 searches = ~$3.00
- Perplexity (current): 1 call = $0.001
- Perplexity (proposed): 85 calls = $0.085
- **Total increase: $0.084 per batch (~3% of BrightData cost)**

**Per Cycle (5 batches, 1,389 entities):**
- Additional Perplexity cost: $0.42
- Reduced false positives: -150 invalid leads
- Manual review time saved: ~10 hours × $50/hr = $500
- **Net benefit: $500 - $0.42 = $499.58 per cycle**

**Per Won RFP:**
- Contract value: £200K-£500K avg
- Competitive intel value: Priceless
- **ROI: >1,000,000:1**

---

## 🚀 Quick Start Implementation

### **Phase 1: Immediate Wins (This Week)**

```bash
# 1. Add URL validation (10 min)
✅ Reject example.com URLs via Perplexity check

# 2. Add deadline extraction (20 min)
✅ Query Perplexity for missing deadlines

# 3. Test on 1 batch (30 min)
✅ Run single batch with Perplexity validation
✅ Measure quality improvement
```

### **Phase 2: Full Integration (Next Week)**

```bash
# 1. Update run-rfp-monitor.sh prompt
✅ Add 3-phase workflow (Discovery → Validation → Intelligence)

# 2. Update JSON schema
✅ Add perplexity_validation and competitive_intel fields

# 3. Test full cycle
✅ Run 5-batch cycle with new Perplexity integration
✅ Compare results vs. baseline
```

### **Phase 3: Advanced Features (Week 3)**

```bash
# 1. Add pre-qualification
✅ Perplexity pre-screens entities before processing

# 2. Add weekly market intelligence
✅ Trend analysis and strategic insights

# 3. Dashboard integration
✅ Display competitive intel in Supabase dashboard
```

---

## 🎯 Success Metrics

**Track in each cycle:**
1. Verification rate (verified_rfps / total_rfps_detected)
2. Placeholder rejection rate
3. Deadline extraction success rate
4. Competitive intel gathering rate (for high-fit)
5. Cost per verified lead
6. Manual review time reduction

**Target KPIs:**
- ✅ Verification rate >50%
- ✅ Placeholder URLs <5%
- ✅ Deadline extracted >90% of verified
- ✅ Competitive intel for 100% of 90+ fit scores
- ✅ Cost per verified lead <$0.10
- ✅ Manual review time -50%

---

## 💡 Pro Tips

1. **Batch Perplexity Calls**: Group similar queries for efficiency
2. **Cache Results**: Store Perplexity responses to avoid duplicate queries
3. **Prioritize High-Value**: Only run competitive intel for fit_score >= 80
4. **Monitor Costs**: Track Perplexity usage per cycle
5. **A/B Test**: Run parallel batches with/without Perplexity to measure impact
6. **Feedback Loop**: Use manual review results to improve prompts

---

**Bottom Line**: Perplexity is your secret weapon for **real-time validation** and **competitive intelligence**. Currently using <1% of its potential. This plan unlocks the remaining 99%.











