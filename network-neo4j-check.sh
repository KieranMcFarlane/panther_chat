#!/bin/bash

echo "🔍 Network Check for Remote Neo4j Server (212.86.105.190)"
echo "========================================================"

HOST="212.86.105.190"
BOLT_PORT="7687"
HTTP_PORT="7474"

echo "📡 Testing network connectivity..."

# Test basic connectivity
echo "1. Basic connectivity test:"
if ping -c 3 $HOST > /dev/null 2>&1; then
    echo "   ✅ Host is reachable"
else
    echo "   ❌ Host is not reachable"
    exit 1
fi

echo ""
echo "2. Port connectivity tests:"

# Test HTTP port (7474)
echo "   HTTP Port $HTTP_PORT (Neo4j Browser):"
if nc -z -w5 $HOST $HTTP_PORT 2>/dev/null; then
    echo "   ✅ Port $HTTP_PORT is open"
    echo "   📊 HTTP response:"
    curl -s --connect-timeout 5 "http://$HOST:$HTTP_PORT" | head -5
else
    echo "   ❌ Port $HTTP_PORT is closed or filtered"
fi

# Test Bolt port (7687)
echo ""
echo "   Bolt Port $BOLT_PORT (Neo4j Bolt):"
if nc -z -w5 $HOST $BOLT_PORT 2>/dev/null; then
    echo "   ✅ Port $BOLT_PORT is open"
else
    echo "   ❌ Port $BOLT_PORT is closed or filtered"
fi

echo ""
echo "3. Neo4j service information:"

# Try to get Neo4j version and info via HTTP
if curl -s --connect-timeout 5 "http://$HOST:$HTTP_PORT" > /dev/null 2>&1; then
    echo "   📊 Neo4j Browser response:"
    curl -s --connect-timeout 5 "http://$HOST:$HTTP_PORT" | jq '.' 2>/dev/null || curl -s --connect-timeout 5 "http://$HOST:$HTTP_PORT"
else
    echo "   ❌ Cannot connect to Neo4j Browser"
fi

echo ""
echo "4. Connection quality test:"
echo "   Testing connection latency..."

# Test connection speed
start_time=$(date +%s.%N)
if curl -s --connect-timeout 5 "http://$HOST:$HTTP_PORT" > /dev/null 2>&1; then
    end_time=$(date +%s.%N)
    latency=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "unknown")
    echo "   ⏱️  HTTP response time: ${latency}s"
else
    echo "   ❌ HTTP connection failed"
fi

echo ""
echo "5. SSL/TLS test for Bolt:"
echo "   Testing SSL connection to Bolt port..."

# Test SSL connection to Bolt port
if openssl s_client -connect $HOST:$BOLT_PORT -servername $HOST < /dev/null 2>/dev/null | grep -q "CONNECTED"; then
    echo "   ✅ SSL connection to Bolt port successful"
    echo "   📋 SSL certificate info:"
    openssl s_client -connect $HOST:$BOLT_PORT -servername $HOST < /dev/null 2>/dev/null | grep -E "(subject=|issuer=|Not After)" | head -3
else
    echo "   ❌ SSL connection to Bolt port failed"
    echo "   💡 This might indicate the server expects non-SSL connections"
fi

echo ""
echo "6. Summary:"
echo "   Host: $HOST"
echo "   HTTP Port ($HTTP_PORT): $(nc -z -w2 $HOST $HTTP_PORT 2>/dev/null && echo "OPEN" || echo "CLOSED")"
echo "   Bolt Port ($BOLT_PORT): $(nc -z -w2 $HOST $BOLT_PORT 2>/dev/null && echo "OPEN" || echo "CLOSED")"

echo ""
echo "💡 Based on our earlier tests, we know:"
echo "   ✅ Neo4j is running and accessible"
echo "   ✅ Database has 290 nodes"
echo "   ✅ Labels: Organization, Federation, Sport"
echo "   ✅ Working with ENCRYPTION_OFF setting"
echo ""
echo "🎯 The issue is likely:"
echo "   1. NeoConverse agent configuration (not database connection)"
echo "   2. Browser Local Storage needs to be configured"
echo "   3. Visit: http://localhost:3001/auto-configure.html"





