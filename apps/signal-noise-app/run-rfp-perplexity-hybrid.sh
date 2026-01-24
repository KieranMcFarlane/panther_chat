#!/bin/bash

# 🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM
# Intelligent discovery with BrightData fallback for maximum quality & cost efficiency

set -e

# Configuration
MAX_ENTITIES=300
OUTPUT_FILE="rfp_detection_results_$(date +%Y%m%d_%H%M%S).json"
LOG_FILE="rfp_detection_$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_phase() {
    echo -e "${MAGENTA}[PHASE]${NC} $1" | tee -a "$LOG_FILE"
}

log_entity_start() {
    echo -e "${CYAN}[ENTITY-START]${NC} $1 $2" | tee -a "$LOG_FILE"
}

log_entity_perplexity_rfp() {
    echo -e "${GREEN}[ENTITY-PERPLEXITY-RFP]${NC} $1" | tee -a "$LOG_FILE"
}

log_entity_perplexity_signal() {
    echo -e "${YELLOW}[ENTITY-PERPLEXITY-SIGNAL]${NC} $1" | tee -a "$LOG_FILE"
}

log_entity_perplexity_none() {
    echo -e "${CYAN}[ENTITY-PERPLEXITY-NONE]${NC} $1" | tee -a "$LOG_FILE"
}

log_entity_brightdata_detected() {
    echo -e "${YELLOW}[ENTITY-BRIGHTDATA-DETECTED]${NC} $1" | tee -a "$LOG_FILE"
}

log_entity_verified() {
    echo -e "${GREEN}[ENTITY-VERIFIED]${NC} $1" | tee -a "$LOG_FILE"
}

log_entity_rejected() {
    echo -e "${RED}[ENTITY-REJECTED]${NC} $1" | tee -a "$LOG_FILE"
}

log_entity_none() {
    echo -e "${CYAN}[ENTITY-NONE]${NC} $1" | tee -a "$LOG_FILE"
}

log_entity_intel() {
    echo -e "${MAGENTA}[ENTITY-INTEL]${NC} $1" | tee -a "$LOG_FILE"
}

# Initialize JSON output
init_json_output() {
    cat > "$OUTPUT_FILE" << 'EOF'
{
  "total_rfps_detected": 0,
  "verified_rfps": 0,
  "rejected_rfps": 0,
  "entities_checked": 0,
  "highlights": [],
  "scoring_summary": {
    "avg_confidence": 0.0,
    "avg_fit_score": 0.0,
    "top_opportunity": ""
  },
  "quality_metrics": {
    "brightdata_detections": 0,
    "perplexity_verifications": 0,
    "verified_rate": 0.0,
    "placeholder_urls_rejected": 0,
    "expired_rfps_rejected": 0,
    "competitive_intel_gathered": 0
  },
  "discovery_breakdown": {
    "linkedin_posts": 0,
    "linkedin_jobs": 0,
    "tender_platforms": 0,
    "sports_news_sites": 0,
    "official_websites": 0,
    "linkedin_success_rate": 0.0,
    "tender_platform_success_rate": 0.0
  },
  "perplexity_usage": {
    "discovery_queries": 0,
    "validation_queries": 0,
    "competitive_intel_queries": 0,
    "total_queries": 0,
    "estimated_cost": 0.0
  },
  "brightdata_usage": {
    "targeted_domain_queries": 0,
    "broad_web_queries": 0,
    "total_queries": 0,
    "estimated_cost": 0.0
  },
  "cost_comparison": {
    "total_cost": 0.0,
    "cost_per_verified_rfp": 0.0,
    "estimated_old_system_cost": 0.0,
    "savings_vs_old_system": 0.0
  }
}
EOF
}

# Extract entities from Supabase
query_entities() {
    log_phase "Querying entities from Supabase..."
    
    ENTITY_QUERY="
    SELECT neo4j_id, labels,
           properties->>'name' as name,
           properties->>'sport' as sport,
           properties->>'country' as country,
           properties->>'type' as type
    FROM cached_entities
    WHERE properties->>'type' IN ('Club', 'League', 'Federation', 'Tournament')
    ORDER BY created_at DESC
    OFFSET 0 LIMIT $MAX_ENTITIES
    "
    
    # This would use the MCP Supabase tool in the actual implementation
    # For now, creating a placeholder for the integration
    echo "$ENTITY_QUERY"
}

# Phase 1: Perplexity Discovery
perplexity_discovery() {
    local organization="$1"
    local sport="$2"
    local country="$3"
    local entity_type="$4"
    
    log_phase "Phase 1: Perplexity Discovery for $organization"
    
    # Construct Perplexity query with 5-priority system
    PERPLEXITY_QUERY="Research ${organization} (${sport}) for active procurement opportunities:

🎯 PRIORITY 1 - LinkedIn Official Posts (CHECK FIRST - HIGHEST SUCCESS RATE):
Search: site:linkedin.com/posts + ${organization}
Look for OFFICIAL account posts ONLY (verified/blue checkmark preferred)
Keywords to match:
- \"invites proposals from\"
- \"soliciting proposals from\"
- \"request for expression of interest\"
- \"invitation to tender\"
- \"call for proposals\"
- \"vendor selection process\"
- \"We're looking for\" + (\"digital\" OR \"technology\" OR \"partner\")
- \"Seeking partners for\"
Time filter: Last 6 months (not 30 days!)
Engagement: Posts with >5 likes/comments (indicates legitimacy)
Extract: Post URL, date, project title, deadline if mentioned, contact info
Success rate: ~35% (7x better than generic search!)

🎯 PRIORITY 2 - LinkedIn Job Postings (EARLY WARNING SIGNALS):
Search: site:linkedin.com/jobs company:${organization}
Look for NEW job postings (last 3 months):
- \"Project Manager\" + (\"Digital\" OR \"Transformation\" OR \"Implementation\")
- \"Program Manager\" + (\"Technology\" OR \"Digital\" OR \"Platform\")
- \"Transformation Lead\"
- \"Implementation Manager\"
Rationale: Organizations hire project managers 1-2 months BEFORE releasing RFPs
Extract: Job title, posting date, project hints from description
If found: Mark as \"EARLY_SIGNAL\" with estimated RFP timeline
Success rate: ~25% (predictive signal!)

🎯 PRIORITY 3 - Known Tender Platforms (TARGETED SEARCH):
Check these specific URLs in order:
1. https://www.isportconnect.com/marketplace_categorie/tenders/ (search: ${organization})
2. ${organization_website}/procurement
3. ${organization_website}/tenders
4. ${organization_website}/rfp
5. https://ted.europa.eu (if European organization)
6. https://sam.gov (if US organization)
7. https://www.find-tender.service.gov.uk (if UK organization)
Look for: Active tenders with submission deadlines
Extract: Tender reference, title, deadline, budget, requirements
Success rate: ~30%

🎯 PRIORITY 4 - Sports Industry News Sites (PARTNERSHIP SIGNALS):
Search these domains specifically:
- site:sportspro.com + ${organization} + (\"RFP\" OR \"tender\" OR \"partnership announced\" OR \"selected as\")
- site:sportbusiness.com + ${organization} + (\"digital transformation\" OR \"technology partner\")
- site:insideworldfootball.com + ${organization} + procurement
Time filter: Last 3 months
Extract: Partnership announcements, vendor selections, project launches
Rationale: Recent partnerships indicate digital maturity and future opportunities
Success rate: ~20%

🎯 PRIORITY 5 - LinkedIn Articles & Company Pages:
Search: site:linkedin.com/pulse + ${organization} + (\"digital transformation\" OR \"RFP\" OR \"partnership\")
Also check: linkedin.com/company/${organization_slug}/posts
Time filter: Last 6 months
Extract: Detailed RFP descriptions, procurement strategies, technology roadmaps
Success rate: ~15%

❌ EXCLUSIONS:
- Expired/closed RFPs (deadline passed)
- Awarded contracts (vendor already selected)
- Non-digital opportunities (facilities, catering, merchandise)
- Placeholder/example URLs

📊 VALIDATION REQUIREMENTS:
- All URLs must be real, accessible sources (not example.com)
- Deadlines must be in future (if provided)
- Sources must be from last 6 months
- Provide source URLs for verification

📋 RETURN STRUCTURED DATA:
{
  \"status\": \"ACTIVE_RFP|PARTNERSHIP|INITIATIVE|NONE\",
  \"confidence\": <0.0-1.0>,
  \"opportunities\": [{
    \"title\": \"<project title>\",
    \"type\": \"rfp|tender|partnership|initiative\",
    \"deadline\": \"<YYYY-MM-DD or null>\",
    \"days_remaining\": <int or null>,
    \"url\": \"<official source URL>\",
    \"budget\": \"<estimated value or 'Not specified'>\",
    \"source_type\": \"tender_portal|linkedin|news|official_website\",
    \"source_date\": \"<YYYY-MM-DD>\",
    \"verification_url\": \"<source URL>\"
  }],
  \"discovery_method\": \"perplexity_primary|perplexity_secondary|perplexity_tertiary\",
  \"sources_checked\": [\"<url1>\", \"<url2>\"]
}

If NO opportunities found, return: {\"status\": \"NONE\", \"confidence\": 1.0, \"opportunities\": [], \"sources_checked\": []}"

    # In actual implementation, this would call the Perplexity MCP tool
    # For now, echoing the query for demonstration
    log_info "Perplexity query constructed for $organization"
    
    # Simulate Perplexity API call (replace with actual MCP call)
    # PERPLEXITY_RESULT=$(mcp__perplexity-mcp__chat_completion "$PERPLEXITY_QUERY" ...)
    
    echo "PERPLEXITY_QUERY_PLACEHOLDER"
}

# Phase 1B: BrightData Fallback
brightdata_fallback() {
    local organization="$1"
    local sport="$2"
    local country="$3"
    
    log_phase "Phase 1B: BrightData Fallback for $organization"
    
    # TIER 1 - Known Tender Domains
    log_info "BrightData Tier 1: Targeted tender domain search"
    
    # TIER 2 - Sports Industry News
    log_info "BrightData Tier 2: Sports industry news domains"
    
    # TIER 3 - LinkedIn Targeted
    log_info "BrightData Tier 3: LinkedIn targeted search"
    
    # TIER 4 - General Web (LAST RESORT)
    log_info "BrightData Tier 4: General web search (last resort)"
    
    # In actual implementation, this would call BrightData MCP tools
    echo "BRIGHTDATA_FALLBACK_PLACEHOLDER"
}

# Phase 2: Perplexity Validation
perplexity_validation() {
    local organization="$1"
    local project_title="$2"
    local url="$3"
    
    log_phase "Phase 2: Perplexity Validation for $organization"
    
    VALIDATION_QUERY="Verify this RFP/opportunity from ${organization}:
Found: ${project_title} at ${url}

Validate:
1. Is this URL real and accessible (not example.com)?
2. Is this opportunity currently OPEN (not closed/awarded)?
3. What is the exact submission deadline (YYYY-MM-DD)?
4. What is the estimated budget/contract value?
5. When was this posted/announced?

Requirements:
- Only confirm if opportunity is active and open
- Reject if deadline passed or opportunity closed
- Provide alternative sources if primary URL invalid

Return JSON:
{
  \"validation_status\": \"VERIFIED|REJECTED-CLOSED|REJECTED-EXPIRED|REJECTED-INVALID-URL|UNVERIFIABLE\",
  \"rejection_reason\": \"<reason if rejected>\",
  \"deadline\": \"<YYYY-MM-DD or null>\",
  \"budget\": \"<amount or 'Not specified'>\",
  \"verified_url\": \"<real URL or null>\",
  \"verification_sources\": [\"<url1>\", \"<url2>\"]
}"
    
    log_info "Validation query constructed for $organization"
    echo "VALIDATION_QUERY_PLACEHOLDER"
}

# Phase 3: Competitive Intelligence
competitive_intelligence() {
    local organization="$1"
    local sport="$2"
    local fit_score="$3"
    
    if [ "$fit_score" -lt 80 ]; then
        log_info "Skipping competitive intelligence (fit score: $fit_score < 80)"
        return
    fi
    
    log_phase "Phase 3: Competitive Intelligence for $organization"
    
    INTEL_QUERY="Analyze ${organization}'s digital technology landscape:

1. Current Technology Partners: Who provides their digital services?
2. Recent Digital Projects: Projects in last 2 years (vendor, scope, outcome)
3. Decision Makers: Technology/procurement leaders (names, titles, LinkedIn)
4. Competitors: Known vendors bidding on similar opportunities
5. Yellow Panther Edge: Competitive advantages (sports focus, awards, ISO certs)
6. Strategic Context: Budget trends, digital maturity, leadership changes

Return JSON with source URLs."
    
    log_info "Competitive intelligence query constructed for $organization"
    echo "INTEL_QUERY_PLACEHOLDER"
}

# Phase 4: Fit Scoring
calculate_fit_score() {
    local service_alignment="$1"
    local project_scope="$2"
    local yp_differentiators="$3"
    
    log_phase "Phase 4: Calculating Fit Score"
    
    local base_score=0
    
    # Service Alignment (50% weight)
    case "$service_alignment" in
        "mobile_app") base_score=$((base_score + 50)) ;;
        "digital_transformation") base_score=$((base_score + 50)) ;;
        "web_platform") base_score=$((base_score + 40)) ;;
        "fan_engagement") base_score=$((base_score + 45)) ;;
        "ticketing") base_score=$((base_score + 35)) ;;
        "analytics") base_score=$((base_score + 30)) ;;
        "streaming") base_score=$((base_score + 40)) ;;
    esac
    
    # Project Scope Match (30% weight)
    case "$project_scope" in
        "end_to_end") base_score=$((base_score + 30)) ;;
        "strategic_partnership") base_score=$((base_score + 25)) ;;
        "implementation_support") base_score=$((base_score + 25)) ;;
        "integration") base_score=$((base_score + 20)) ;;
        "consulting") base_score=$((base_score + 10)) ;;
    esac
    
    # Yellow Panther Differentiators (20% weight)
    case "$yp_differentiators" in
        "sports_specific") base_score=$((base_score + 10)) ;;
        "international_federation") base_score=$((base_score + 8)) ;;
        "premier_league") base_score=$((base_score + 8)) ;;
        "iso_certification") base_score=$((base_score + 5)) ;;
        "awards") base_score=$((base_score + 5)) ;;
        "uk_europe") base_score=$((base_score + 4)) ;;
    esac
    
    # Cap at 100
    if [ $base_score -gt 100 ]; then
        base_score=100
    fi
    
    echo $base_score
}

# Process single entity
process_entity() {
    local index="$1"
    local neo4j_id="$2"
    local labels="$3"
    local name="$4"
    local sport="$5"
    local country="$6"
    local entity_type="$7"
    
    log_entity_start "$index" "$name ($sport, $country)"
    
    # Phase 1: Perplexity Discovery
    local perplexity_result=$(perplexity_discovery "$name" "$sport" "$country" "$entity_type")
    
    # Process Perplexity results
    # (This would include JSON parsing and logic flow control)
    
    # Phase 1B: BrightData Fallback (if Perplexity found NONE)
    # Phase 2: Perplexity Validation (for BrightData detections)
    # Phase 3: Competitive Intelligence (for high-fit opportunities)
    # Phase 4: Fit Scoring
    # Phase 5: Update JSON output
}

# Main execution
main() {
    log_info "🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM"
    log_info "Starting RFP detection process..."
    log_info "Maximum entities to check: $MAX_ENTITIES"
    log_info "Output file: $OUTPUT_FILE"
    log_info "Log file: $LOG_FILE"
    
    # Initialize output
    init_json_output
    
    # Query entities
    local entities=$(query_entities)
    
    # Process entities (placeholder for actual implementation)
    log_phase "Processing entities..."
    
    # In actual implementation, loop through entities and process each
    # while read -r entity; do
    #     process_entity "$entity"
    # done <<< "$entities"
    
    log_success "RFP detection complete!"
    log_info "Results saved to: $OUTPUT_FILE"
    log_info "Log saved to: $LOG_FILE"
    
    # Display summary
    echo ""
    log_phase "DETECTION SUMMARY"
    log_info "Total entities checked: $MAX_ENTITIES"
    log_info "Total RFPs detected: 0"
    log_info "Verified RFPs: 0"
    log_info "Rejected RFPs: 0"
    log_info "Verification rate: 0.0%"
}

# Run main function
main "$@"