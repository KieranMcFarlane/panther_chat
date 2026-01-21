#!/usr/bin/env python3
"""
FalkorDB + Graphiti Integration Verification Script

Tests the complete integration from Supabase extraction through
FalkorDB import to temporal intelligence API.

Usage:
    # Run all tests
    python backend/verify_integration.py

    # Run specific test
    python backend/verify_integration.py --test supabase
    python backend/verify_integration.py --test falkordb
    python backend/verify_integration.py --test graphiti
    python backend/verify_integration.py --test api
    python backend/verify_integration.py --test frontend

    # Verbose mode
    python backend/verify_integration.py --verbose
"""

import os
import sys
import json
import asyncio
import argparse
import logging
from datetime import datetime
from typing import Dict, List, Any
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IntegrationVerifier:
    """Verify the FalkorDB + Graphiti integration"""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.results: Dict[str, Dict] = {}
        self.project_root = Path(__file__).parent.parent

    def log(self, message: str, level: str = 'info'):
        """Log message if verbose"""
        if self.verbose or level == 'error':
            getattr(logger, level)(message)

    # ========================================================================
    # Test 1: Environment Configuration
    # ========================================================================

    def test_environment(self) -> bool:
        """Verify environment variables are set"""
        print("\n🔍 Testing environment configuration...")

        required_vars = {
            'FALKORDB_URI': 'bolt://localhost:7687',
            'FALKORDB_USER': 'falkordb',
            'FALKORDB_PASSWORD': None,  # Must be set
            'FALKORDB_DATABASE': 'sports_intelligence',
            # Supabase (for extraction)
            'NEXT_PUBLIC_SUPABASE_URL': None,
            'NEXT_PUBLIC_SUPABASE_ANON_KEY': None,
        }

        all_present = True
        for var, default in required_vars.items():
            value = os.getenv(var)
            if value is None:
                if default is None:
                    print(f"  ❌ {var} not set")
                    all_present = False
                else:
                    print(f"  ⚠️  {var} not set (will use: {default})")
            else:
                masked_value = value[:10] + '...' if len(value) > 10 and 'PASSWORD' in var or 'KEY' in var else value
                print(f"  ✅ {var}={masked_value}")

        self.results['environment'] = {
            'status': 'passed' if all_present else 'failed',
            'timestamp': datetime.now().isoformat()
        }

        return all_present

    # ========================================================================
    # Test 2: Supabase Extraction
    # ========================================================================

    async def test_supabase_extraction(self) -> bool:
        """Test Supabase connection and extraction"""
        print("\n🔍 Testing Supabase extraction...")

        try:
            from extract_from_supabase import SupabaseExtractor
        except ImportError as e:
            print(f"  ❌ Failed to import: {e}")
            print("  💡 Run: pip install supabase")
            return False

        try:
            extractor = SupabaseExtractor()

            # Test extraction with small batch
            entities = await extractor.extract_all_entities(batch_size=5)

            print(f"  ✅ Connected to Supabase")
            print(f"  ✅ Extracted {len(entities)} sample entities")

            if entities:
                sample = entities[0]
                print(f"     Sample: {sample.labels[0]} - {sample.properties.get('name', 'Unknown')}")

            self.results['supabase'] = {
                'status': 'passed',
                'entities_extracted': len(entities),
                'timestamp': datetime.now().isoformat()
            }

            return True

        except Exception as e:
            print(f"  ❌ Supabase extraction failed: {e}")
            self.results['supabase'] = {
                'status': 'failed',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            return False

    # ========================================================================
    # Test 3: FalkorDB Connection
    # ========================================================================

    def test_falkordb_connection(self) -> bool:
        """Test FalkorDB BOLT connection"""
        print("\n🔍 Testing FalkorDB connection...")

        try:
            from neo4j import GraphDatabase
        except ImportError:
            print("  ❌ neo4j not installed")
            print("  💡 Run: pip install neo4j")
            return False

        try:
            uri = os.getenv('FALKORDB_URI') or os.getenv('NEO4J_URI', 'bolt://localhost:7687')
            user = os.getenv('FALKORDB_USER') or os.getenv('NEO4J_USER', 'neo4j')
            password = os.getenv('FALKORDB_PASSWORD') or os.getenv('NEO4J_PASSWORD', '')

            driver = GraphDatabase.driver(uri, auth=(user, password))
            driver.verify_connectivity()

            with driver.session() as session:
                result = session.run("RETURN 1 as test")
                record = result.single()

                if record and record["test"] == 1:
                    print(f"  ✅ Connected to FalkorDB: {uri}")

                    # Get database info
                    info_result = session.run("CALL dbms.components() YIELD name, versions")
                    for record in info_result:
                        print(f"     Database: {record['name']}")
                        print(f"     Version: {record['versions'][0]}")

                    driver.close()

                    self.results['falkordb'] = {
                        'status': 'passed',
                        'uri': uri,
                        'timestamp': datetime.now().isoformat()
                    }

                    return True

            driver.close()
            return False

        except Exception as e:
            print(f"  ❌ FalkorDB connection failed: {e}")
            self.results['falkordb'] = {
                'status': 'failed',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            return False

    # ========================================================================
    # Test 4: Graphiti Service
    # ========================================================================

    async def test_graphiti_service(self) -> bool:
        """Test Graphiti temporal service"""
        print("\n🔍 Testing Graphiti service...")

        try:
            from graphiti_service import GraphitiService
        except ImportError as e:
            print(f"  ❌ Failed to import: {e}")
            return False

        try:
            service = GraphitiService()
            initialized = await service.initialize()

            if initialized:
                print(f"  ✅ Graphiti service initialized")

                # Test adding an RFP episode
                test_rfp = {
                    'rfp_id': f'verification-test-{int(datetime.now().timestamp())}',
                    'organization': 'Verification Test FC',
                    'entity_type': 'Club',
                    'detected_at': datetime.now().isoformat(),
                    'description': 'Test RFP for verification',
                    'source': 'verification_script',
                    'category': 'Testing',
                    'confidence_score': 1.0
                }

                result = await service.add_rfp_episode(test_rfp)
                print(f"  ✅ Created test episode: {result['episode_id']}")

                # Test temporal analysis
                analysis = await service.analyze_temporal_fit(
                    'Verification Test FC',
                    test_rfp['rfp_id']
                )
                print(f"  ✅ Temporal analysis complete (fit score: {analysis['fit_score']:.2f})")

                service.close()

                self.results['graphiti'] = {
                    'status': 'passed',
                    'episode_created': result['episode_id'],
                    'fit_score': analysis['fit_score'],
                    'timestamp': datetime.now().isoformat()
                }

                return True

            service.close()
            return False

        except Exception as e:
            print(f"  ❌ Graphiti service failed: {e}")
            self.results['graphiti'] = {
                'status': 'failed',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            return False

    # ========================================================================
    # Test 5: FastAPI Backend
    # ========================================================================

    async def test_api_endpoints(self) -> bool:
        """Test FastAPI temporal endpoints"""
        print("\n🔍 Testing FastAPI backend endpoints...")

        import httpx

        api_url = os.getenv('FASTAPI_URL', 'http://localhost:8000')

        try:
            async with httpx.AsyncClient() as client:
                # Test health endpoint
                response = await client.get(f"{api_url}/health", timeout=5.0)

                if response.status_code == 200:
                    data = response.json()
                    print(f"  ✅ Health check: {data['status']}")
                    print(f"     Version: {data.get('version', 'unknown')}")
                else:
                    print(f"  ❌ Health check failed: {response.status_code}")
                    return False

                # Test temporal patterns endpoint
                response = await client.get(f"{api_url}/api/temporal/patterns", timeout=5.0)

                if response.status_code == 200:
                    data = response.json()
                    print(f"  ✅ Temporal patterns endpoint working")
                    print(f"     Total episodes: {data.get('total_episodes', 0)}")
                else:
                    print(f"  ⚠️  Temporal patterns returned: {response.status_code}")

                # Test RFP episode creation
                test_rfp = {
                    'rfp_id': f'api-test-{int(datetime.now().timestamp())}',
                    'organization': 'API Test Club',
                    'entity_type': 'Club',
                    'description': 'API test RFP',
                    'source': 'verification_script'
                }

                response = await client.post(
                    f"{api_url}/api/temporal/rfp-episode",
                    json=test_rfp,
                    timeout=5.0
                )

                if response.status_code == 200:
                    data = response.json()
                    print(f"  ✅ Created RFP episode via API: {data['episode_id']}")
                else:
                    print(f"  ⚠️  RFP episode creation returned: {response.status_code}")

                self.results['api'] = {
                    'status': 'passed',
                    'api_url': api_url,
                    'timestamp': datetime.now().isoformat()
                }

                return True

        except httpx.ConnectError:
            print(f"  ❌ Cannot connect to FastAPI at {api_url}")
            print("  💡 Start the backend: cd backend && python main.py")
            self.results['api'] = {
                'status': 'failed',
                'error': 'connection_refused',
                'timestamp': datetime.now().isoformat()
            }
            return False
        except Exception as e:
            print(f"  ❌ API test failed: {e}")
            self.results['api'] = {
                'status': 'failed',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            return False

    # ========================================================================
    # Test 6: Frontend Files
    # ========================================================================

    def test_frontend_files(self) -> bool:
        """Verify frontend component files exist"""
        print("\n🔍 Testing frontend components...")

        required_files = {
            'API Routes': [
                'src/app/api/temporal/rfp-episode/route.ts',
                'src/app/api/temporal/entity/[entityId]/timeline/route.ts',
                'src/app/api/temporal/analyze-fit/route.ts',
                'src/app/api/temporal/patterns/route.ts',
            ],
            'Components': [
                'src/components/temporal/EntityTimeline.tsx',
                'src/components/rfp/TemporalIntelligenceDashboard.tsx',
            ],
        }

        all_exist = True

        for category, files in required_files.items():
            print(f"\n  {category}:")
            for file_path in files:
                full_path = self.project_root / file_path
                if full_path.exists():
                    print(f"    ✅ {file_path}")
                else:
                    print(f"    ❌ {file_path} missing")
                    all_exist = False

        self.results['frontend'] = {
            'status': 'passed' if all_exist else 'failed',
            'timestamp': datetime.now().isoformat()
        }

        return all_exist

    # ========================================================================
    # Summary Report
    # ========================================================================

    def print_summary(self):
        """Print summary of all tests"""
        print("\n" + "=" * 60)
        print("📊 VERIFICATION SUMMARY")
        print("=" * 60)

        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results.values() if r['status'] == 'passed')

        for test_name, result in self.results.items():
            status_icon = '✅' if result['status'] == 'passed' else '❌'
            print(f"{status_icon} {test_name.upper()}: {result['status']}")

        print(f"\nTotal: {passed_tests}/{total_tests} tests passed")

        if passed_tests == total_tests:
            print("\n🎉 All tests passed! Integration is ready.")
        else:
            print("\n⚠️  Some tests failed. Review the output above.")

        # Save results to file
        results_file = self.project_root / 'verification_results.json'
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)

        print(f"\n📁 Results saved to: {results_file}")

    # ========================================================================
    # Main Run Method
    # ========================================================================

    async def run(self, tests: List[str] = None):
        """Run specified tests or all tests"""
        if tests is None:
            tests = ['environment', 'supabase', 'falkordb', 'graphiti', 'api', 'frontend']

        print("🚀 Starting FalkorDB + Graphiti Integration Verification")
        print("=" * 60)

        for test in tests:
            if test == 'environment':
                self.test_environment()
            elif test == 'supabase':
                await self.test_supabase_extraction()
            elif test == 'falkordb':
                self.test_falkordb_connection()
            elif test == 'graphiti':
                await self.test_graphiti_service()
            elif test == 'api':
                await self.test_api_endpoints()
            elif test == 'frontend':
                self.test_frontend_files()

        self.print_summary()


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Verify FalkorDB + Graphiti integration'
    )
    parser.add_argument(
        '--test', '-t',
        choices=['environment', 'supabase', 'falkordb', 'graphiti', 'api', 'frontend'],
        action='append',
        help='Specific test(s) to run (default: all)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()

    verifier = IntegrationVerifier(verbose=args.verbose)
    await verifier.run(args.test)


if __name__ == '__main__':
    asyncio.run(main())
