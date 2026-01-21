#!/bin/bash

echo "🧪 Testing API with curl to identify 404 issue..."
echo

# Function to test a single request
test_request() {
    local message="$1"
    local test_name="$2"
    
    echo "📤 Testing $test_name: \"$message\""
    
    # Create unique thread ID for each request
    local thread_id="curl_test_$(date +%s)_$RANDOM"
    
    # Make the request
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nTOTAL_TIME:%{time_total}\n" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{
            \"variables\": {
                \"data\": {
                    \"messages\": [
                        {
                            \"id\": \"test_$(date +%s)_$RANDOM\",
                            \"textMessage\": {
                                \"role\": \"user\",
                                \"content\": \"$message\"
                            }
                        }
                    ],
                    \"threadId\": \"$thread_id\"
                }
            }
        }" \
        http://localhost:3005/api/copilotkit)
    
    # Extract status code and timing
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    total_time=$(echo "$response" | grep "TOTAL_TIME:" | cut -d: -f2)
    
    # Extract response body (everything before the metadata)
    response_body=$(echo "$response" | sed -e '/HTTP_STATUS:/,$d')
    
    echo "✅ $test_name - Status: $http_status"
    echo "⏱️  $test_name - Time: ${total_time}s"
    
    if [ "$http_status" = "200" ]; then
        # Count chunks in response
        chunk_count=$(echo "$response_body" | grep -c "^data: " || echo "0")
        echo "📦 $test_name - Chunks: $chunk_count"
        
        # Show first few chunks
        echo "$response_body" | grep "^data: " | head -3 | sed 's/^/📄 /'
        
        if [ "$chunk_count" -gt 3 ]; then
            echo "   ... ($((chunk_count - 3)) more chunks)"
        fi
    else
        echo "❌ $test_name - Error response:"
        echo "$response_body" | head -10 | sed 's/^/❌ /'
    fi
    
    echo
    
    # Wait between requests
    if [ "$test_name" != "Third Request" ]; then
        echo "⏳ Waiting 3 seconds..."
        sleep 3
    fi
}

# Check if server is running
echo "🔍 Checking if server is running..."
if curl -s http://localhost:3005/minimal-test > /dev/null; then
    echo "✅ Server is running"
    echo
else
    echo "❌ Server is not running"
    echo "💡 Please run 'npm run dev' first"
    exit 1
fi

# Test sequence
test_request "hi" "First Request"
test_request "how is arsenal doing?" "Second Request"
test_request "tell me about chelsea" "Third Request"

echo "🎉 API curl test completed!"