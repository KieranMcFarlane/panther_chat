#!/bin/bash

# Test script for LinkedIn RFP search without requiring real API keys
# This demonstrates the headless Claude Agent SDK approach

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

log "🧪 Testing Claude Agent SDK LinkedIn RFP Search (Demo Mode)"
log "=========================================================="

# Check if we have the virtual environment
VENV_DIR="$PROJECT_DIR/venv-claude-sdk"
if [ ! -d "$VENV_DIR" ]; then
    warn "Creating virtual environment for Claude Agent SDK..."
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install claude-agent-sdk
else
    info "Using existing virtual environment"
fi

# Create a test version of the script that works without API keys
warn "Creating demo version that works without API keys..."

cat > "$PROJECT_DIR/scripts/test-linkedin-search-demo.py" << 'EOF'
#!/usr/bin/env python3
"""
Demo version of LinkedIn RFP search that shows the Claude Agent SDK integration
without requiring actual API keys. This demonstrates the headless approach.
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

# Mock Claude Agent SDK for demonstration
class MockClaudeSDKClient:
    def __init__(self, options=None):
        self.options = options or {}
        
    async def connect(self):
        print("✅ Connected to Mock Claude Agent SDK")
        
    async def disconnect(self):
        print("🔌 Disconnected from Mock Claude Agent SDK")
        
    async def query(self, prompt):
        print("📤 Sending search query to Mock Claude...")
        
    async def receive_response(self):
        # Simulate finding LinkedIn RFP opportunities
        mock_results = [
            {
                "organization": "Manchester United FC",
                "title": "Stadium Digital Transformation RFP",
                "description": "Seeking vendors for comprehensive stadium Wi-Fi upgrade and mobile app development",
                "deadline": "2024-12-15",
                "value": "$2.5M - $5M",
                "url": "https://linkedin.com/posts/manutd/rfp-stadium-digital-12345",
                "source": "LinkedIn",
                "publication_date": "2024-11-01"
            },
            {
                "organization": "Premier League",
                "title": "Broadcast Technology Platform Tender",
                "description": "Digital streaming platform and content management system for league broadcasts",
                "deadline": "2025-01-31",
                "value": "$10M+",
                "url": "https://linkedin.com/posts/premierleague/broadcast-tech-rfp-67890",
                "source": "LinkedIn",
                "publication_date": "2024-11-05"
            },
            {
                "organization": "Wembley Stadium",
                "title": "Mobile Ticketing System RFP",
                "description": "Complete mobile-first ticketing and fan engagement platform",
                "deadline": "2024-12-20",
                "value": "$1.5M - $3M",
                "url": "https://linkedin.com/posts/wembley/ticketing-rfp-11223",
                "source": "LinkedIn",
                "publication_date": "2024-11-03"
            }
        ]
        
        # Yield mock messages
        yield MockMessage("system", "Mock search initiated")
        yield MockMessage("assistant", f"Found {len(mock_results)} relevant RFP opportunities on LinkedIn")
        yield MockMessage("result", json.dumps(mock_results, indent=2))

class MockMessage:
    def __init__(self, msg_type, content):
        self.type = msg_type
        self.result = content if msg_type == "result" else None
        if hasattr(content, 'text'):
            self.content = [content]
        elif msg_type == "assistant":
            self.content = [MockTextBlock(content)]
            
class MockTextBlock:
    def __init__(self, text):
        self.text = text

async def main():
    print("🚀 Mock LinkedIn RFP Search - Claude Agent SDK Integration Demo")
    print("=" * 65)
    
    print("📋 This demonstrates how the headless Claude Agent SDK would work with:")
    print("   ✅ Claude Agent SDK for AI reasoning")
    print("   ✅ BrightData MCP server for LinkedIn scraping")
    print("   ✅ RFP opportunity detection and analysis")
    print("   ✅ JSON output for integration with existing systems")
    print()
    
    # Simulate the search process
    client = MockClaudeSDKClient()
    await client.connect()
    
    await client.query("""
    Search LinkedIn for RFP and tender opportunities in the sports industry.
    Look for digital transformation projects, mobile apps, and technology upgrades.
    """)
    
    results = []
    async for message in client.receive_response():
        if message.type == "assistant":
            print(f"🤖 {message.content[0].text}")
        elif message.type == "result":
            print("✅ Search completed - Processing results...")
            try:
                parsed_results = json.loads(message.result)
                results.extend(parsed_results)
                print(f"📊 Found {len(parsed_results)} RFP opportunities")
            except:
                print("⚠️  Could not parse results")
    
    await client.disconnect()
    
    # Save demo results
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    output_file = Path(f"logs/demo-linkedin-rfp-results-{timestamp}.json")
    output_file.parent.mkdir(exist_ok=True)
    
    output_data = {
        "search_metadata": {
            "timestamp": datetime.now().isoformat(),
            "source": "LinkedIn via Claude Agent SDK + BrightData MCP (Demo)",
            "total_results": len(results),
            "search_type": "RFP and tender opportunities",
            "mode": "Demonstration - no real API calls"
        },
        "configuration": {
            "mcp_servers": {
                "brightdata": {
                    "type": "stdio",
                    "command": "node",
                    "args": ["src/mcp-brightdata-server.js"],
                    "tools": ["search_engine", "scrape_as_markdown", "scrape_batch"]
                }
            },
            "allowed_tools": [
                "mcp__brightdata__search_engine",
                "mcp__brightdata__scrape_as_markdown",
                "mcp__brightdata__scrape_batch"
            ]
        },
        "results": results
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Demo results saved to: {output_file}")
    print(f"📈 Found {len(results)} sample RFP opportunities")
    
    print("\n🔧 To use with real API keys:")
    print("   1. Set ANTHROPIC_API_KEY environment variable")
    print("   2. Set BRIGHTDATA_TOKEN environment variable") 
    print("   3. Run: ./scripts/run-linkedin-rfp-search.sh")
    
    print("\n📋 Sample Results:")
    for i, result in enumerate(results[:3], 1):
        org = result.get('organization', 'Unknown')
        title = result.get('title', 'No title')
        value = result.get('value', 'Value not specified')
        print(f"   {i}. {org} - {title} ({value})")
    
    print("\n✅ Demo completed! This shows the headless integration working.")
    print("   The real version would search actual LinkedIn content using BrightData.")

if __name__ == "__main__":
    asyncio.run(main())
EOF

chmod +x "$PROJECT_DIR/scripts/test-linkedin-rfp-demo.py"

log "🎬 Running demo of headless LinkedIn RFP search..."

# Activate virtual environment and run demo
source "$VENV_DIR/bin/activate"
cd "$PROJECT_DIR"
python3 scripts/test-linkedin-rfp-demo.py

log "✅ Demo completed successfully!"
log ""
log "🔧 Next steps for production use:"
log "   1. Get ANTHROPIC_API_KEY from https://console.anthropic.com"
log "   2. Get BRIGHTDATA_TOKEN from BrightData dashboard"
log "   3. Run: ./scripts/run-linkedin-rfp-search.sh"
log ""
log "📁 Demo results saved to: logs/demo-linkedin-rfp-results-*.json"