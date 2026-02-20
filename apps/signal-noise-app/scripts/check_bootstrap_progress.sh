#!/bin/bash

echo "=========================================="
echo "📊 Production Template Discovery Progress"
echo "=========================================="
echo ""

# Check if process is running
if pgrep -f "production_template_bootstrap.sh" > /dev/null; then
    echo "✅ Bootstrap process is running"
    echo ""
else
    echo "⚠️  Bootstrap process NOT running"
    echo ""
fi

# Check entity loading
if [ -f "data/all_entities.json" ]; then
    ENTITY_COUNT=$(jq '.metadata.entity_count' data/all_entities.json)
    echo "✅ Entities loaded: $ENTITY_COUNT"
else
    echo "⏳ Entities not yet loaded"
fi

# Check clustering progress
if [ -f "data/clustering_checkpoint.json" ]; then
    COMPLETED=$(jq '.completed_batches | length' data/clustering_checkpoint.json)
    TOTAL_CLUSTERS=$(jq '.clusters | length' data/clustering_checkpoint.json)
    echo "✅ Clustering: Batch $COMPLETED/30 complete"
    echo "   Clusters so far: $TOTAL_CLUSTERS"
else
    echo "⏳ Clustering not started"
fi

# Check if clusters file exists
if [ -f "data/production_clusters.json" ]; then
    CLUSTER_COUNT=$(jq '. | length' data/production_clusters.json)
    echo "✅ Clustering complete: $CLUSTER_COUNT clusters"
else
    echo "⏳ Clustering in progress..."
fi

# Check template discovery
if [ -f "data/production_templates.json" ]; then
    TEMPLATE_COUNT=$(jq '. | length' data/production_templates.json)
    echo "✅ Templates discovered: $TEMPLATE_COUNT"
else
    echo "⏳ Template discovery pending..."
fi

# Check validation
if [ -f "bootstrapped_templates/validation_report.json" ]; then
    HIGH_QUALITY=$(jq '[.validation_reports[] | select(.meets_threshold == true)] | length' bootstrapped_templates/validation_report.json)
    MIN_CONF=$( jq '[.validation_reports[].template_confidence] | min' bootstrapped_templates/validation_report.json)
    echo "✅ Validation complete: $HIGH_QUALITY high-quality templates (min: $MIN_CONF)"
else
    echo "⏳ Validation pending..."
fi

# Check completion
if [ -f "bootstrapped_templates/bootstrap_summary.json" ]; then
    echo ""
    echo "🎉 Bootstrap COMPLETE!"
    echo ""
    echo "Summary:"
    cat bootstrapped_templates/bootstrap_summary.json | jq '.'
fi

echo ""
echo "=========================================="
echo "📁 Recent logs:"
echo "=========================================="
ls -lt logs/production_bootstrap_*.log 2>/dev/null | head -3
echo ""
echo "Monitor: tail -f logs/production_bootstrap_$(date +%Y%m%d).log"
