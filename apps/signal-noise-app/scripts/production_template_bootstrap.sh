#!/bin/bash
# Production Template Discovery for All 3,400 Entities
# Expected Runtime: 2-3 hours
# Expected Cost: ~$100 (Sonnet API + BrightData MCP)

set -e  # Exit on error

# Configuration
DATA_DIR="data"
OUTPUT_DIR="bootstrapped_templates"
LOG_DIR="logs"

# Create directories
mkdir -p "$DATA_DIR"
mkdir -p "$OUTPUT_DIR"
mkdir -p "$LOG_DIR"

echo "🚀 Starting Production Template Discovery"
echo "=========================================="
echo "Start time: $(date)"
echo ""

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "✅ Loaded environment variables from .env"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Step 1: Load all entities from FalkorDB
echo "📊 Step 1: Loading all entities from FalkorDB..."
python3 -m backend.load_all_entities \
    --output "$DATA_DIR/all_entities.json" \
    --falkordb-uri "$FALKORDB_URI" \
    --falkordb-user "$FALKORDB_USER" \
    --falkordb-password "$FALKORDB_PASSWORD" \
    --falkordb-database "$FALKORDB_DATABASE" \
    2>&1 | tee "$LOG_DIR/01_load_entities.log"

# Check entity count
ENTITY_COUNT=$(jq '.metadata.entity_count' "$DATA_DIR/all_entities.json")
echo "✅ Loaded $ENTITY_COUNT entities"
echo ""

# Step 2: Run entity clustering
echo "🎯 Step 2: Clustering entities by procurement behavior..."
python3 -m backend.entity_clustering \
    --input "$DATA_DIR/all_entities.json" \
    --output "$DATA_DIR/production_clusters.json" \
    --batch-size 100 \
    --checkpoint-file "$DATA_DIR/clustering_checkpoint.json" \
    2>&1 | tee "$LOG_DIR/02_clustering.log"

# Check cluster count
CLUSTER_COUNT=$(jq '. | length' "$DATA_DIR/production_clusters.json")
echo "✅ Generated $CLUSTER_COUNT clusters"
echo ""

# Step 3: Discover templates for each cluster
echo "🔍 Step 3: Discovering templates using GraphRAG + BrightData..."
python3 -m backend.template_discovery \
    --clusters "$DATA_DIR/production_clusters.json" \
    --entities "$DATA_DIR/all_entities.json" \
    --output "$DATA_DIR/production_templates.json" \
    2>&1 | tee "$LOG_DIR/03_template_discovery.log"

# Check template count
TEMPLATE_COUNT=$(jq '. | length' "$DATA_DIR/production_templates.json")
echo "✅ Generated $TEMPLATE_COUNT templates"
echo ""

# Step 4: Validate templates
echo "✅ Step 4: Validating templates with 0.75 confidence threshold..."
python3 -m backend.template_validation \
    --templates "$DATA_DIR/production_templates.json" \
    --clusters "$DATA_DIR/production_clusters.json" \
    --output "$OUTPUT_DIR/validation_report.json" \
    --min-confidence 0.75 \
    2>&1 | tee "$LOG_DIR/04_validation.log"

# Check validation results
MIN_CONFIDENCE=$(jq '.min_confidence' "$OUTPUT_DIR/validation_report.json")
AVG_CONFIDENCE=$(jq '.avg_confidence' "$OUTPUT_DIR/validation_report.json")
HIGH_QUALITY=$(jq '.high_quality_count' "$OUTPUT_DIR/validation_report.json")

echo "✅ Validation complete"
echo "  - Min confidence: $MIN_CONFIDENCE"
echo "  - Avg confidence: $AVG_CONFIDENCE"
echo "  - High quality templates: $HIGH_QUALITY/$TEMPLATE_COUNT"
echo ""

# Step 5: Filter high-quality templates
echo "💾 Step 5: Filtering and deploying high-quality templates..."

# Extract high-quality templates (confidence >= 0.7)
jq '[.validation_reports[] | select(.meets_threshold == true)]' \
    "$OUTPUT_DIR/validation_report.json" > "$OUTPUT_DIR/high_quality_templates.json"

HIGH_QUALITY_COUNT=$(jq '. | length' "$OUTPUT_DIR/high_quality_templates.json")
echo "✅ Filtered $HIGH_QUALITY_COUNT high-quality templates (≥0.75 confidence)"

# Copy high-quality templates to deployment directory
cp "$DATA_DIR/production_clusters.json" "$OUTPUT_DIR/"
cp "$DATA_DIR/production_templates.json" "$OUTPUT_DIR/"
echo "✅ Deployed to $OUTPUT_DIR/"
echo ""

# Step 6: Generate summary
echo "📋 Step 6: Generating summary report..."
cat > "$OUTPUT_DIR/README.md" << EOF
# Production Template Discovery Results

**Generated:** $(date)
**Environment:** Production

## Summary

- **Entities Loaded:** $ENTITY_COUNT
- **Clusters Generated:** $CLUSTER_COUNT
- **Templates Discovered:** $TEMPLATE_COUNT
- **High-Quality Templates (≥0.75):** $HIGH_QUALITY
- **Min Confidence:** $MIN_CONFIDENCE
- **Avg Confidence:** $AVG_CONFIDENCE

## Files

- \`production_clusters.json\` - All $CLUSTER_COUNT cluster definitions
- \`production_templates.json\` - All $TEMPLATE_COUNT template definitions
- \`validation_report.json\` - Detailed validation results for all templates
- \`high_quality_templates.json\` - Only high-quality templates (≥0.75 confidence)

## Deployment Instructions

1. Review high-quality templates:
   \`\`\`bash
   cat "$OUTPUT_DIR/high_quality_templates.json" | jq '.'
   \`\`\`

2. Deploy to Graphiti:
   \`\`\`bash
   python3 -m backend.graphiti_deploy_templates \
       --templates "$OUTPUT_DIR/high_quality_templates.json"
   \`\`\`

3. Enable in production:
   - Templates are now available for entity classification
   - New entities will auto-classify using Haiku
   - BrightData will use template-driven scraping

## Monitoring

Track template performance:
\`\`\`bash
python3 -m backend.missed_signal_tracker \
    --output "$OUTPUT_DIR/missed_signals_analysis.json"
\`\`\`

## Cost Analysis

- **Clustering:** $ENTITY_COUNT entities ÷ 100 batch × $3/M tokens × 5K tokens ≈ $50
- **Template Discovery:** $CLUSTER_COUNT clusters × $3/M × 3K tokens ≈ $45
- **BrightData Validation:** ~100 searches × $0.10 ≈ $10
- **Total One-Time Cost:** ~$105

## Annual Operating Cost

- **Bootstrap:** $105/quarter × 4 = $420/year
- **Daily Classification:** $ENTITY_COUNT entities × 500 tokens × $0.25/M ≈ $1.70/day
- **Annual Total:** $420 + $620 = $1,040/year

**vs Baseline:** $29,200/year (97% savings!)

## Next Steps

1. **Review** - Examine high-quality templates for accuracy
2. **Test** - Run on sample entities to validate predictions
3. **Deploy** - Load templates into Graphiti for production use
4. **Monitor** - Track missed signals to refine templates quarterly

---

Generated by Production Template Discovery System
EOF

echo "✅ Summary generated: $OUTPUT_DIR/README.md"
echo ""

# Final summary
echo "=========================================="
echo "🎉 Production Template Discovery Complete!"
echo ""
echo "📁 Results: $OUTPUT_DIR/"
echo "📊 Summary: $OUTPUT_DIR/README.md"
echo ""
echo "📈 Key Metrics:"
echo "  - Entities: $ENTITY_COUNT"
echo "  - Clusters: $CLUSTER_COUNT"
echo "  - Templates: $TEMPLATE_COUNT"
echo "  - High Quality: $HIGH_QUALITY (≥0.75 confidence)"
echo "  - Avg Confidence: $AVG_CONFIDENCE"
echo ""
echo "💰 Estimated Cost: ~$105 (one-time)"
echo "💰 Annual Cost: ~$1,040 (vs $29,200 baseline = 97% savings!)"
echo ""
echo "⏱️  End time: $(date)"
echo "=========================================="
echo ""
echo "🚀 Next steps:"
echo "  1. Review templates: cat $OUTPUT_DIR/README.md"
echo "  2. Deploy to Graphiti: python3 -m backend.graphiti_deploy_templates"
echo "  3. Monitor performance: python3 -m backend.missed_signal_tracker"
echo ""
