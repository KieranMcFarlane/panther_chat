# Production Template Bootstrap - Quick Start

## One Command to Rule Them All

```bash
bash scripts/production_template_bootstrap.sh
```

**Runtime**: ~3 hours
**Cost**: ~$105 (one-time)
**Output**: `bootstrapped_templates/`

---

## What This Does

1. **Loads** 3,400 entities from FalkorDB
2. **Clusters** entities by procurement behavior (40-60 clusters)
3. **Discovers** templates using Claude + BrightData MCP
4. **Validates** templates against real web data
5. **Deploys** high-quality templates (≥0.7 confidence)

---

## Prerequisites

✅ FalkorDB running with 3,400+ entities
✅ BrightData MCP server running
✅ Claude API key (Sonnet)
✅ Python 3.10+

---

## Quick Test First

```bash
# Test pipeline with 10 entities (5 minutes)
bash scripts/test_template_discovery.sh

# Expected:
# ✅ Test Pipeline Complete!
# 📁 Results: data/test_discovery/
```

---

## Full Production Run

```bash
# Run full bootstrap
bash scripts/production_template_bootstrap.sh

# Monitor progress
tail -f logs/02_clustering.log    # Clustering (45 min)
tail -f logs/03_template_discovery.log  # Template discovery (90 min)

# Check results
cat bootstrapped_templates/README.md
```

---

## Expected Results

```
bootstrapped_templates/
├── README.md                     # Summary report
├── production_clusters.json      # 40-60 clusters
├── production_templates.json     # 40-60 templates
├── validation_report.json        # Validation results
└── high_quality_templates.json   # Only ≥0.7 confidence
```

**Key Metrics**:
- Entities: 3,400
- Clusters: 40-60
- Templates: 40-60
- High Quality: 95%+ (≥0.7 confidence)
- Avg Confidence: 0.8+

---

## Deployment

```bash
# Deploy to Graphiti
python -m backend.graphiti_deploy_templates \
    --templates bootstrapped_templates/high_quality_templates.json

# Verify deployment
python -m backend.graphiti_query \
    --query "MATCH (t:Template) RETURN count(t)"
```

---

## Annual Cost

**Baseline** (blind scraping): $7,446/year
**With Templates**: $1,040/year
**Savings**: $6,406/year (86%!)

---

## Troubleshooting

### Resume from Checkpoint

```bash
# If script fails, just run again
# Checkpoint auto-saves every batch
bash scripts/production_template_bootstrap.sh
```

### BrightData MCP Not Running

```bash
# Start BrightData MCP server
python backend/brightdata_mcp_server.py &

# Verify
ps aux | grep brightdata
```

### Low Template Confidence

```bash
# Review low-quality templates
jq '.validation_reports[] | select(.meets_threshold == false)' \
    bootstrapped_templates/validation_report.json

# Common fixes:
# 1. Add more signal channels
# 2. Increase sample size
# 3. Refine patterns
```

---

## Next Steps

1. ✅ Run quick test: `bash scripts/test_template_discovery.sh`
2. ✅ Run production: `bash scripts/production_template_bootstrap.sh`
3. ✅ Review results: `cat bootstrapped_templates/README.md`
4. ✅ Deploy to Graphiti
5. ✅ Monitor performance weekly

---

**Questions?** See [Full Documentation](docs/production-template-discovery-implementation.md)

Generated: 2026-01-28
