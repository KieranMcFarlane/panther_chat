#!/usr/bin/env python3
"""
Simplified test for Arsenal FC - generates one section at a time
"""

import asyncio
import sys
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from claude_client import ClaudeClient
from dossier_templates import get_prompt_template


async def test_single_section():
    """Test generating a single section for Arsenal FC"""
    print("=" * 60)
    print("SINGLE SECTION TEST - ARSENAL FC")
    print("=" * 60)
    
    try:
        # Initialize
        print("\n[1/2] Initializing ClaudeClient...")
        client = ClaudeClient()
        
        if client.api_key:
            print(f"✅ API Key: {client.api_key[:20]}...")
            print(f"✅ Base URL: {client.base_url}")
        else:
            print("❌ No API key found")
            return
        
        # Generate one section
        print("\n[2/2] Testing 'core_information' section (Haiku)...")
        print("   Entity: Arsenal FC")
        print("   Model: Haiku (fastest)")
        
        # Get template
        template = get_prompt_template("core_info_template", "haiku")
        
        # Format with entity data
        entity_data = {
            "entity_name": "Arsenal FC",
            "founded": "1886",
            "stadium": "Emirates Stadium",
            "capacity": "60,704",
            "league": "Premier League"
        }
        
        prompt = template.format(**entity_data)
        
        print(f"\n   Prompt preview (first 150 chars): {prompt[:150]}...")
        
        # Start timer
        start = datetime.now()
        
        # Call Claude
        print("\n   Calling Claude API...")
        response = await client.query(
            prompt=prompt,
            model="haiku",
            max_tokens=1000
        )
        
        # Calculate time
        end = datetime.now()
        elapsed = (end - start).total_seconds()
        
        # Show result
        print(f"\n✅ SUCCESS in {elapsed:.2f}s!")
        print(f"   Model used: {response.get('model_used', 'unknown')}")
        print(f"   Content length: {len(response.get('content', ''))} chars")
        
        # Show preview
        content = response.get('content', '')
        if len(content) > 300:
            preview = content[:300] + "..."
        else:
            preview = content
        print(f"\n   Content preview:\n{preview}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_single_section())
    
    if success:
        print("\n" + "=" * 60)
        print("✅ Single section test passed!")
        print("The API is working. Full dossier may take longer.")
        print("=" * 60)
    else:
        print("\n❌ Test failed - see errors above")
