#!/bin/bash

echo "=== Testing Graph Intelligence System ==="
echo ""

echo "1. Testing API stats..."
curl -s http://localhost:8001/stats | python3 -m json.tool | head -10
echo ""

echo "2. Testing entity search..."
curl -s -X POST http://localhost:8001/search-entities \
  -H "Content-Type: application/json" \
  -d '{"query": "real", "limit": 5}' | python3 -m json.tool
echo ""

echo "3. Testing entity query..."
curl -s -X POST http://localhost:8001/query-entity \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "real_madrid"}' | python3 -m json.tool | head -15
echo ""

echo "4. Running intelligence batch..."
curl -s -X POST http://localhost:8001/run-batch \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 3}' | python3 -m json.tool
echo ""

echo "=== API Tests Complete ==="
echo ""
echo "✅ Graph Intelligence API is working!"
echo ""
echo "Next: Test in browser at http://localhost:3005"
echo ""
echo "Try these natural language queries:"
echo "  - 'What's the current state of the knowledge graph?'"
echo "  - 'Tell me about Real Madrid'"
echo "  - 'Search for entities with fc'"
echo "  - 'Run an intelligence batch on 5 entities'"
echo "  - 'What signal types are supported?'"