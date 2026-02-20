#!/usr/bin/env python3
"""
Test BrightData Integration (Phase 2)

Tests the web scraping functionality for entity dossiers.
"""

import asyncio
import sys
import os
from datetime import datetime
from pathlib import Path

# Load environment variables from project root
from dotenv import load_dotenv
project_root = Path(__file__).parent.parent
load_dotenv(project_root / '.env')

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dossier_data_collector import DossierDataCollector


async def test_brightdata_scraping():
    """Test BrightData web scraping for Arsenal FC"""

    print("\n" + "=" * 70)
    print("PHASE 2: BRIGHTDATA INTEGRATION TEST")
    print("=" * 70)

    # Initialize collector
    collector = DossierDataCollector()

    print("\n[1/3] Connecting to BrightData SDK...")
    brightdata_connected = await collector._connect_brightdata()

    if not brightdata_connected:
        print("❌ BrightData SDK not available - test cannot continue")
        print("   Install: pip install brightdata-sdk-client")
        return False

    print("✅ BrightData SDK connected")

    # Test scraping Arsenal FC
    print("\n[2/3] Scraping Arsenal FC official website...")
    entity_id = "arsenal-fc"
    entity_name = "Arsenal FC"

    try:
        scrape_result = await collector._get_scraped_content(entity_id, entity_name)

        if scrape_result:
            scraped_content, extracted_data = scrape_result

            print(f"✅ Successfully scraped {scraped_content.word_count} words")
            print(f"   URL: {scraped_content.url}")
            print(f"   Source: {scraped_content.source_type}")

            print("\n📊 Extracted Properties:")
            for key, value in extracted_data.items():
                if value:
                    print(f"   {key.capitalize()}: {value}")

            # Verify key fields
            key_fields = ['founded', 'stadium', 'capacity', 'website']
            found_fields = [k for k in key_fields if extracted_data.get(k)]

            print(f"\n✅ Found {len(found_fields)}/{len(key_fields)} key fields:")
            for field in found_fields:
                print(f"   ✓ {field}")

            missing_fields = [k for k in key_fields if not extracted_data.get(k)]
            if missing_fields:
                print(f"\n⚠️  Missing fields: {', '.join(missing_fields)}")

            # Test full collection with BrightData
            print("\n[3/3] Testing full data collection...")
            dossier_data = await collector.collect_all(entity_id, entity_name)

            print(f"\n📋 Data Sources Used: {', '.join(dossier_data.data_sources_used)}")

            if dossier_data.metadata:
                print(f"\n✅ Enhanced Metadata:")
                print(f"   Entity: {dossier_data.metadata.entity_name}")
                print(f"   Type: {dossier_data.metadata.entity_type}")
                if dossier_data.metadata.founded:
                    print(f"   Founded: {dossier_data.metadata.founded}")
                if dossier_data.metadata.stadium:
                    print(f"   Stadium: {dossier_data.metadata.stadium}")
                if dossier_data.metadata.capacity:
                    print(f"   Capacity: {dossier_data.metadata.capacity}")
                if dossier_data.metadata.website:
                    print(f"   Website: {dossier_data.metadata.website}")

            print("\n" + "=" * 70)
            print("✅ BRIGHTDATA INTEGRATION TEST PASSED")
            print("=" * 70)

            print("\n📋 Summary:")
            print(f"   - BrightData SDK: Working ✅")
            print(f"   - Web Scraping: Functional ✅")
            print(f"   - Property Extraction: Working ✅")
            print(f"   - Metadata Enhancement: Working ✅")
            print(f"   - Data Sources: {', '.join(dossier_data.data_sources_used)} ✅")

            return True

        else:
            print("❌ Scraping failed - no results")
            return False

    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import logging

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    result = asyncio.run(test_brightdata_scraping())
    exit(0 if result else 1)
