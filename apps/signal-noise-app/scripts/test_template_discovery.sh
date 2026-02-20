#!/bin/bash
# Test Template Discovery Pipeline
# Run on small sample to validate the workflow

set -e

echo "🧪 Testing Template Discovery Pipeline"
echo "========================================"
echo ""

# Test with 10 entities (quick validation)
TEST_ENTITIES=10
TEST_OUTPUT="data/test_discovery"

mkdir -p "$TEST_OUTPUT"

echo "📊 Step 1: Creating test entity sample..."
cat > "$TEST_OUTPUT/test_entities.json" << 'EOF'
{
  "metadata": {
    "generated_at": "2026-01-28T00:00:00Z",
    "entity_count": 10,
    "source": "test",
    "purpose": "Template discovery validation"
  },
  "entities": [
    {
      "entity_id": "arsenal_fc",
      "name": "Arsenal FC",
      "sport": "football",
      "country": "England",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "liverpool_fc",
      "name": "Liverpool FC",
      "sport": "football",
      "country": "England",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "manchester_united",
      "name": "Manchester United",
      "sport": "football",
      "country": "England",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "chelsea_fc",
      "name": "Chelsea FC",
      "sport": "football",
      "country": "England",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "manchester_city",
      "name": "Manchester City",
      "sport": "football",
      "country": "England",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "tottenham_hotspur",
      "name": "Tottenham Hotspur",
      "sport": "football",
      "country": "England",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "real_madrid",
      "name": "Real Madrid",
      "sport": "football",
      "country": "Spain",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "barcelona",
      "name": "FC Barcelona",
      "sport": "football",
      "country": "Spain",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "bayern_munich",
      "name": "Bayern Munich",
      "sport": "football",
      "country": "Germany",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    },
    {
      "entity_id": "psg",
      "name": "Paris Saint-Germain",
      "sport": "football",
      "country": "France",
      "org_type": "club",
      "estimated_revenue_band": "high",
      "digital_maturity": "high"
    }
  ]
}
EOF

echo "✅ Created test entities: $TEST_ENTITIES"
echo ""

echo "🎯 Step 2: Testing clustering..."
python3 -m backend.entity_clustering \
    --input "$TEST_OUTPUT/test_entities.json" \
    --output "$TEST_OUTPUT/test_clusters.json" \
    --batch-size 10 \
    2>&1 | tee "$TEST_OUTPUT/01_clustering.log"

CLUSTER_COUNT=$(jq '. | length' "$TEST_OUTPUT/test_clusters.json" 2>/dev/null || echo "0")
echo "✅ Generated $CLUSTER_COUNT clusters"
echo ""

echo "🔍 Step 3: Testing template discovery..."
# Skip BrightData for quick test
python3 -m backend.template_discovery \
    --clusters "$TEST_OUTPUT/test_clusters.json" \
    --entities "$TEST_OUTPUT/test_entities.json" \
    --output "$TEST_OUTPUT/test_templates.json" \
    --no-brightdata \
    2>&1 | tee "$TEST_OUTPUT/02_template_discovery.log"

TEMPLATE_COUNT=$(jq '. | length' "$TEST_OUTPUT/test_templates.json" 2>/dev/null || echo "0")
echo "✅ Generated $TEMPLATE_COUNT templates"
echo ""

echo "✅ Step 4: Testing template validation..."
python3 -m backend.template_validation \
    --templates "$TEST_OUTPUT/test_templates.json" \
    --clusters "$TEST_OUTPUT/test_clusters.json" \
    --output "$TEST_OUTPUT/test_validation_report.json" \
    2>&1 | tee "$TEST_OUTPUT/03_validation.log"

MIN_CONFIDENCE=$(jq '.min_confidence // 0' "$TEST_OUTPUT/test_validation_report.json" 2>/dev/null || echo "0")
AVG_CONFIDENCE=$(jq '.avg_confidence // 0' "$TEST_OUTPUT/test_validation_report.json" 2>/dev/null || echo "0")
echo "✅ Validation complete"
echo "  - Min confidence: $MIN_CONFIDENCE"
echo "  - Avg confidence: $AVG_CONFIDENCE"
echo ""

echo "========================================"
echo "✅ Test Pipeline Complete!"
echo ""
echo "📁 Results: $TEST_OUTPUT/"
echo "  - test_clusters.json: $CLUSTER_COUNT clusters"
echo "  - test_templates.json: $TEMPLATE_COUNT templates"
echo "  - test_validation_report.json: validation results"
echo ""
echo "🚀 Ready for production run:"
echo "  bash scripts/production_template_bootstrap.sh"
echo ""
