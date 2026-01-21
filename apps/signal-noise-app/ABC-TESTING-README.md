# 🎯 Multi-Strategy RFP A/B/C Testing System

## Overview

This system allows you to test three different RFP detection strategies in parallel on the same entity set to compare their performance and identify the most effective approach.

## Strategies Implemented

### 🧠 Perplexity-First
- **Primary**: Perplexity comprehensive search for official tenders
- **Secondary**: BrightData for document/PDF validation
- **Tertiary**: Perplexity competitive intelligence
- **Optimized for**: Deep research, government procurement sites, tender databases

### 💼 LinkedIn-First
- **Primary**: BrightData LinkedIn company posts & announcements
- **Secondary**: Perplexity validation and context
- **Tertiary**: BrightData web search for RFP documents
- **Optimized for**: Social signals, executive announcements, partnership news

### 🌐 BrightData-First
- **Primary**: BrightData comprehensive web crawl
- **Secondary**: Perplexity validation and enrichment
- **Tertiary**: BrightData targeted domain search
- **Optimized for**: Direct RFP documents, procurement portals, PDF links

## System Components

### Monitor Scripts
- `run-rfp-monitor-perplexity.sh` - Perplexity-first strategy
- `run-rfp-monitor-linkedin.sh` - LinkedIn-first strategy
- `run-rfp-monitor-brightdata.sh` - BrightData-first strategy

### Orchestration
- `run-rfp-batches-abc.sh` - Runs all 3 strategies in parallel per batch
- `run-rfp-aggregate-abc.sh` - Aggregates results and generates comparison

### Testing
- `test-abc-single-batch.sh` - Tests all 3 strategies on batch 1 (300 entities)

### Database
- `migrations/add_detection_strategy.sql` - Adds strategy tracking columns

## Usage

### Quick Test (Single Batch)

Test all 3 strategies on the first 300 entities:

```bash
./test-abc-single-batch.sh
```

This will:
1. Run all 3 strategies in parallel on batch 1
2. Verify each strategy tags results correctly
3. Generate ABC comparison report
4. Show performance metrics

### Full Production Run

Run all 3 strategies on all entities:

```bash
./run-rfp-batches-abc.sh --reset
```

### Resume Interrupted Run

```bash
./run-rfp-batches-abc.sh
```

## Output Files

### Strategy-Specific Results
Results are tagged with the strategy that found them:

```
logs/rfp_results_batch1_perplexity_TIMESTAMP_clean.json
logs/rfp_results_batch1_linkedin_TIMESTAMP_clean.json
logs/rfp_results_batch1_brightdata_TIMESTAMP_clean.json
```

### Comparison Report
```
logs/run_abc_TIMESTAMP/rfp_strategy_comparison_TIMESTAMP.md
```

Example report structure:

```markdown
# Strategy Performance Metrics

| Strategy      | Total RFPs | Avg Confidence | Avg Fit | Unique Finds |
|---------------|-----------|----------------|---------|--------------|
| Perplexity    | 45        | 87.2           | 89.5    | 8            |
| LinkedIn      | 38        | 82.5           | 84.2    | 3            |
| BrightData    | 52        | 84.1           | 86.7    | 11           |
| **Combined**  | **67**    | **-**          | **-**   | **-**        |
```

### Deduplicated Master File
```
logs/run_abc_TIMESTAMP/rfp_deduplicated_master.json
```

Contains unique RFPs with `found_by_strategies` array showing which strategies found each one.

## Database Integration

### Supabase Schema Changes

Apply the migration to add strategy tracking:

```sql
-- From migrations/add_detection_strategy.sql
ALTER TABLE rfp_opportunities 
ADD COLUMN detection_strategy TEXT;

ALTER TABLE rfp_opportunities
ADD COLUMN found_by_strategies JSONB DEFAULT '[]'::jsonb;
```

Or apply via Supabase dashboard SQL editor.

### Query Examples

```sql
-- Count RFPs by strategy
SELECT detection_strategy, COUNT(*) 
FROM rfp_opportunities 
GROUP BY detection_strategy;

-- Find RFPs detected by multiple strategies
SELECT organization, title, found_by_strategies
FROM rfp_opportunities
WHERE jsonb_array_length(found_by_strategies) > 1;

-- Compare strategy performance
SELECT 
  detection_strategy,
  COUNT(*) as total_rfps,
  AVG(confidence) as avg_confidence,
  AVG(yellow_panther_fit) as avg_fit_score
FROM rfp_opportunities
WHERE detection_strategy IS NOT NULL
GROUP BY detection_strategy;
```

## Architecture

### Parallel Execution Model

Each batch processes the SAME 300 entities through all 3 strategies simultaneously:

```
Batch 1: entities 0-299
  ├─ Perplexity-first  (PID 1001) → rfp_results_batch1_perplexity.json
  ├─ LinkedIn-first    (PID 1002) → rfp_results_batch1_linkedin.json
  └─ BrightData-first  (PID 1003) → rfp_results_batch1_brightdata.json

Batch 2: entities 300-599
  ├─ Perplexity-first  (PID 1004) → rfp_results_batch2_perplexity.json
  ├─ LinkedIn-first    (PID 1005) → rfp_results_batch2_linkedin.json
  └─ BrightData-first  (PID 1006) → rfp_results_batch2_brightdata.json
```

### Throttling

- `MAX_PARALLEL=2` batches (configurable)
- Each batch = 3 parallel processes
- Total: 6 concurrent strategy executions

### Deduplication Logic

1. Combine all RFPs from all strategies
2. Group by organization (case-insensitive)
3. Group by title similarity (fuzzy match)
4. Keep highest fit_score version
5. Tag with all strategies that found it

## Performance Metrics

The comparison report includes:

- **Total RFPs**: Count of opportunities detected
- **Entities Checked**: Number of entities processed
- **Avg Confidence**: Average confidence score (0-100)
- **Avg Fit Score**: Average Yellow Panther fit score (0-100)
- **Unique Finds**: RFPs found ONLY by this strategy

## Monitoring

### Real-Time Progress

Watch the orchestrator log:

```bash
tail -f logs/test-cron.log | grep -E "Batch|Strategy|✅|❌"
```

### Check Individual Strategy

```bash
# Perplexity
tail -f logs/run_abc_TIMESTAMP/batch_1_perplexity_TIMESTAMP.log

# LinkedIn
tail -f logs/run_abc_TIMESTAMP/batch_1_linkedin_TIMESTAMP.log

# BrightData
tail -f logs/run_abc_TIMESTAMP/batch_1_brightdata_TIMESTAMP.log
```

## Troubleshooting

### Strategy Not Finding Any RFPs

1. Check the strategy's log file
2. Verify MCP connections (Neo4j, BrightData, Perplexity, Supabase)
3. Check prompt is being processed correctly
4. Verify API credits (BrightData/Perplexity)

### Results Not Tagged with Strategy

Ensure `DETECTION_STRATEGY` environment variable is set in each monitor script:

```bash
grep "DETECTION_STRATEGY" run-rfp-monitor-*.sh
```

Should show:
```
run-rfp-monitor-perplexity.sh:export DETECTION_STRATEGY="perplexity"
run-rfp-monitor-linkedin.sh:export DETECTION_STRATEGY="linkedin"
run-rfp-monitor-brightdata.sh:export DETECTION_STRATEGY="brightdata"
```

### Aggregation Fails

Ensure result files exist:

```bash
ls -l logs/rfp_results_batch*_{perplexity,linkedin,brightdata}_*_clean.json
```

### Supabase Upload Issues

1. Check `SUPABASE_ACCESS_TOKEN` in `mcp-config.json`
2. Verify table schema has `detection_strategy` column
3. Check Supabase MCP is enabled in allowedTools

## Cost Considerations

Each batch runs 3 strategies, so costs are 3x a single strategy:

- **BrightData**: 3 searches per entity (900 total per batch)
- **Perplexity**: 3 queries per entity (900 total per batch)
- **Neo4j**: 3 reads of same data (cached, minimal cost)
- **Claude**: 3 prompts per batch

**Recommendation**: Start with test mode (single batch) to estimate costs.

## Next Steps

1. ✅ Run `./test-abc-single-batch.sh` to verify system works
2. Review comparison report to identify best strategy
3. Run full ABC test with `./run-rfp-batches-abc.sh --reset`
4. Analyze results in Supabase
5. Choose winning strategy for production deployment

## Production Deployment

After determining the best strategy:

1. Update `run-rfp-batches.sh` to use winning strategy
2. Set environment variable: `RFP_MONITOR_SCRIPT=/path/to/run-rfp-monitor-{strategy}.sh`
3. Schedule via cron: `0 */6 * * * cd /path && ./run-rfp-batches.sh`

## Files Reference

```
apps/signal-noise-app/
├── run-rfp-monitor-perplexity.sh    # Perplexity-first strategy
├── run-rfp-monitor-linkedin.sh       # LinkedIn-first strategy
├── run-rfp-monitor-brightdata.sh     # BrightData-first strategy
├── run-rfp-batches-abc.sh            # ABC orchestrator
├── run-rfp-aggregate-abc.sh          # ABC aggregation & comparison
├── test-abc-single-batch.sh          # Single batch test
├── migrations/
│   └── add_detection_strategy.sql    # Supabase schema changes
└── logs/
    ├── rfp_results_batch*_perplexity_*_clean.json
    ├── rfp_results_batch*_linkedin_*_clean.json
    ├── rfp_results_batch*_brightdata_*_clean.json
    └── run_abc_TIMESTAMP/
        ├── rfp_strategy_comparison_TIMESTAMP.md
        ├── rfp_deduplicated_master.json
        └── batch_*_{perplexity,linkedin,brightdata}_TIMESTAMP.log
```

---

**Created**: 2025-11-09  
**Version**: 1.0  
**Status**: Production Ready ✅











