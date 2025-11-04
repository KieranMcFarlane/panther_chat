#!/usr/bin/env python3
"""
Simple test script to verify the Claude Agent SDK webhook integration
"""

import asyncio
import json
import httpx
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_webhook():
    """Test the FastAPI webhook endpoint"""
    
    print("🧪 Testing Claude Agent SDK Webhook Integration")
    print("=" * 50)
    
    # Test data
    test_request = {
        "messages": [
            {"role": "user", "content": "Hello! Can you help me find sports clubs?"}
        ],
        "context": {
            "projectType": "sports intelligence",
            "userRole": "analyst"
        },
        "userId": "test-user-123",
        "stream": True
    }
    
    try:
        # Test non-streaming first
        print("\n1. Testing non-streaming webhook...")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8001/webhook/chat",
                json=test_request,
                timeout=30.0
            )
            
            if response.status_code == 200:
                print("✅ Non-streaming test successful!")
                result = response.json()
                print(f"   Response type: {result.get('type', 'unknown')}")
                if 'response' in result:
                    print(f"   Response length: {len(result['response'])} chars")
            else:
                print(f"❌ Non-streaming test failed: {response.status_code}")
                print(f"   Error: {response.text}")
                return False
    
    except httpx.ConnectError:
        print("❌ Could not connect to webhook server")
        print("   Make sure the FastAPI server is running on port 8001")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False
    
    try:
        # Test streaming
        print("\n2. Testing streaming webhook...")
        test_request["stream"] = True
        
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                "http://localhost:8001/webhook/chat",
                json=test_request,
                timeout=30.0
            ) as response:
                if response.status_code == 200:
                    print("✅ Streaming test started successfully!")
                    
                    chunk_count = 0
                    async for chunk in response.aiter_text():
                        if chunk.strip():
                            try:
                                data = json.loads(chunk.strip())
                                chunk_count += 1
                                print(f"   Chunk {chunk_count}: {data.get('type', 'unknown')}")
                                
                                if data.get('type') == 'message':
                                    content = data.get('content', '')[:100]
                                    print(f"      Content preview: {content}...")
                                    
                                if data.get('type') == 'stream_end':
                                    print("✅ Streaming completed successfully!")
                                    break
                                    
                            except json.JSONDecodeError:
                                print(f"   Raw chunk: {chunk[:50]}...")
                                
                                # Check for stream end marker
                                if '"stream_end"' in chunk:
                                    print("✅ Streaming completed!")
                                    break
                    
                    if chunk_count == 0:
                        print("❌ No chunks received")
                        return False
                        
                else:
                    print(f"❌ Streaming test failed: {response.status_code}")
                    return False
    
    except Exception as e:
        print(f"❌ Streaming test error: {e}")
        return False
    
    print("\n3. Testing health endpoint...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8001/health", timeout=5.0)
            
            if response.status_code == 200:
                health = response.json()
                print("✅ Health check passed!")
                print(f"   Status: {health.get('status')}")
                print(f"   MCP Servers: {health.get('mcp_servers', 0)}")
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
                
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    
    print("\n🎉 All tests passed!")
    print("The Claude Agent SDK webhook integration is working correctly.")
    return True

async def test_nextjs():
    """Test if Next.js application is running"""
    
    print("\n4. Testing Next.js application...")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:3005", timeout=5.0)
            
            if response.status_code == 200:
                print("✅ Next.js application is running!")
                return True
            else:
                print(f"❌ Next.js application responded with: {response.status_code}")
                return False
                
    except httpx.ConnectError:
        print("❌ Could not connect to Next.js application")
        print("   Make sure the Next.js app is running on port 3005")
        return False
    except Exception as e:
        print(f"❌ Next.js test error: {e}")
        return False

async def main():
    """Main test function"""
    
    print("🔍 Claude Agent SDK + CopilotKit Integration Test")
    print("=" * 55)
    
    # Check custom API configuration
    print("\n🔗 Checking API configuration...")
    
    # Set custom API configuration
    os.environ["ANTHROPIC_BASE_URL"] = "https://api.z.ai/api/anthropic"
    os.environ["ANTHROPIC_AUTH_TOKEN"] = "c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c"
    
    base_url = os.getenv("ANTHROPIC_BASE_URL")
    auth_token = os.getenv("ANTHROPIC_AUTH_TOKEN")
    
    if base_url and auth_token:
        print(f"   Base URL: ✅ {base_url}")
        print(f"   Auth Token: ✅ {auth_token[:20]}...")
    else:
        print("   ❌ API configuration missing")
        return 1
    
    # Test webhook
    webhook_ok = await test_webhook()
    
    # Test Next.js
    nextjs_ok = await test_nextjs()
    
    print("\n" + "=" * 55)
    print("📊 Test Results:")
    print(f"   FastAPI Webhook: {'✅ PASS' if webhook_ok else '❌ FAIL'}")
    print(f"   Next.js App:      {'✅ PASS' if nextjs_ok else '❌ FAIL'}")
    
    if webhook_ok and nextjs_ok:
        print("\n🎉 Integration test PASSED!")
        print("\nYou can now:")
        print("   1. Open http://localhost:3005 in your browser")
        print("   2. Click the chat button (bottom-right)")
        print("   3. Try asking: 'Find Premier League clubs'")
        print("   4. Try asking: 'Execute a Neo4j query'")
        return 0
    else:
        print("\n❌ Integration test FAILED!")
        print("\nTroubleshooting:")
        if not webhook_ok:
            print("   • Check if FastAPI server is running: python claude-webhook-server.py")
            print("   • Verify port 8001 is available")
            print("   • Check Python dependencies: pip install -r requirements-webhook.txt")
        
        if not nextjs_ok:
            print("   • Check if Next.js is running: npm run dev")
            print("   • Verify port 3005 is available")
            print("   • Check Node.js dependencies: npm install")
        
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)