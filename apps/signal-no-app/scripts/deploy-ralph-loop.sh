#!/bin/bash
set -e

echo "=========================================="
echo "🚀 RALPH LOOP DEPLOYMENT"
echo "=========================================="
echo ""

# Check for required environment variables
if [ ! -f .env.ralph ]; then
    echo "❌ .env.ralph file not found!"
    echo "Please create it from the template"
    exit 1
fi

# Source environment variables
export $(grep -v '^#' .env.ralph | xargs)

echo "📋 Environment check:"
echo "   ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+✅ set}"
echo "   FALKORDB_URI: ${FALKORDB_URI:+✅ set}"
echo "   REDIS_URL: ${REDIS_URL:+✅ set}"
echo ""

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.ralph.yml down
echo ""

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.ralph.yml up -d --build
echo ""

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
echo ""

# Check FalkorDB
echo "1. FalkorDB:"
if docker exec falkordb-graph timeout 5 bash -c "cat < /dev/tcp/localhost/7687" 2>/dev/null; then
    echo "   ✅ FalkorDB is responding"
else
    echo "   ⚠️  FalkorDB not ready yet"
fi

# Check Redis
echo ""
echo "2. Redis:"
if docker exec redis-cache redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Redis is responding"
else
    echo "   ⚠️  Redis not ready yet"
fi

# Check webhook handler
echo ""
echo "3. Webhook Handler:"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        echo "   ✅ Webhook handler is ready"
        break
    fi
    attempt=$((attempt + 1))
    echo "   ⏳ Waiting... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "   ❌ Webhook handler failed to start"
    docker-compose -f docker-compose.ralph.yml logs webhook-handler
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ ALL SERVICES RUNNING"
echo "=========================================="
echo ""

# Show service URLs
echo "📍 Service URLs:"
echo "   - Webhook Handler: http://localhost:8001"
echo "   - Grafana Dashboard: http://localhost:3000 (admin/admin)"
echo "   - Prometheus Metrics: http://localhost:9090"
echo ""

# Send test webhook
echo "=========================================="
echo "🧪 SENDING TEST WEBHOOK"
echo "=========================================="
echo ""

# Wait a bit more for everything to be ready
sleep 5

# Create test webhook payload
TEST_WEBHOOK='{
  "id": "test-webhook-'$(date +%s)'",
  "source": "test",
  "entity_id": "arsenal_fc",
  "entity_name": "Arsenal FC",
  "type": "RFP_DETECTED",
  "confidence": 0.92,
  "evidence": [
    {
      "source": "LinkedIn",
      "credibility_score": 0.85,
      "url": "https://linkedin.com/jobs/test",
      "date": "'$(date +%Y-%m-%d)'",
      "text": "Test job posting"
    },
    {
      "source": "Graphiti corroboration",
      "credibility_score": 0.75,
      "related_signal_id": "test-rfp-001",
      "date": "'$(date +%Y-%m-%d)'"
    },
    {
      "source": "Perplexity",
      "credibility_score": 0.70,
      "date": "'$(date +%Y-%m-%d)'"
    }
  ],
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "metadata": {
    "test": true,
    "job_title": "Test Digital Transformation Lead"
  }
}'

echo "📤 Sending webhook to http://localhost:8001/api/webhooks/signal"
echo ""

# Send webhook
RESPONSE=$(curl -s -X POST http://localhost:8001/api/webhooks/signal \
  -H "Content-Type: application/json" \
  -d "$TEST_WEBHOOK")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check logs
echo "=========================================="
echo "📋 RECENT LOGS"
echo "=========================================="
echo ""
echo "Webhook Handler logs:"
docker-compose -f docker-compose.ralph.yml logs --tail=20 webhook-handler 2>/dev/null | tail -10
echo ""

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "📖 Next Steps:"
echo "   1. View Grafana dashboard: http://localhost:3000"
echo "   2. Check Prometheus metrics: http://localhost:9090"
echo "   3. Send more webhooks:"
echo "      curl -X POST http://localhost:8001/api/webhooks/signal \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d @your-webhook.json"
echo ""
echo "📊 Monitoring:"
echo "   - View logs: docker-compose -f docker-compose.ralph.yml logs -f"
echo "   - Stop services: docker-compose -f docker-compose.ralph.yml down"
echo ""
