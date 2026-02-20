#!/usr/bin/env python3
"""
Full Runtime Binding Discovery with BrightData SDK

Populates runtime bindings with discovered data:
- discovered_domains: Official websites via BrightData SDK
- discovered_channels: LinkedIn jobs, press releases, etc. via BrightData SDK
- enriched_patterns: Reserved for future Claude Agent SDK exploration

Usage:
    cd backend
    python3 -m full_runtime_discovery --limit 10
    python3 -m full_runtime_discovery --all
"""

import asyncio
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('full_runtime_discovery.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class RuntimeBindingDiscovery:
    """Orchestrate full discovery pipeline for all entities with cluster assignments"""

    def __init__(self, binding_dir: str = "data/runtime_bindings"):
        """
        Initialize discovery orchestrator

        Args:
            binding_dir: Directory containing runtime binding JSON files
        """
        from brightdata_sdk_client import BrightDataSDKClient

        self.binding_dir = Path(binding_dir)
        self.brightdata = BrightDataSDKClient()

    async def discover_official_website(
        self,
        entity_name: str,
        num_results: int = 5
    ) -> List[str]:
        """
        Discover official website for entity

        Args:
            entity_name: Name of the entity (e.g., "Boca Juniors")
            num_results: Number of search results to check

        Returns:
            List of discovered domains (unique)
        """
        try:
            # Search for official website
            search_query = f'"{entity_name}" official website'
            logger.info(f"🔍 Searching for official website: {search_query}")

            search_result = await self.brightdata.search_engine(
                search_query,
                engine='google',
                num_results=num_results
            )

            discovered_domains = []

            if search_result['status'] == 'success':
                # Check metadata to see if we're using real BrightData or fallback
                metadata = search_result.get('metadata', {})
                source = metadata.get('source', 'unknown')

                if source == 'fallback':
                    logger.warning(f"⚠️ Using fallback results for {entity_name} - check API token")
                    return discovered_domains

                for result in search_result['results']:
                    url = result['url']

                    # Extract domain from URL
                    parsed = urlparse(url)
                    domain = parsed.netloc

                    # Remove www. prefix for consistency
                    if domain.startswith('www.'):
                        domain = domain[4:]

                    # Filter out common non-official domains
                    if self._is_official_domain(domain, entity_name):
                        if domain not in discovered_domains:
                            discovered_domains.append(domain)
                            logger.info(f"  ✓ Found domain: {domain}")

            return discovered_domains

        except Exception as e:
            logger.error(f"❌ Error discovering website for {entity_name}: {e}")
            return []

    def _is_official_domain(self, domain: str, entity_name: str) -> bool:
        """
        Check if domain looks like official entity domain

        Args:
            domain: Domain to check
            entity_name: Entity name for reference

        Returns:
            True if domain appears official
        """
        # Exclude social media platforms
        social_platforms = [
            'instagram.com', 'twitter.com', 'x.com', 'facebook.com',
            'linkedin.com', 'youtube.com', 'tiktok.com', 'threads.net'
        ]

        for platform in social_platforms:
            if platform in domain:
                return False

        # Exclude generic content platforms
        exclude_domains = [
            'wikipedia.org', 'thesportsdb.com', 'transfermarkt.com',
            'espn.com', 'bbc.com', 'sky.com'
        ]

        for exclude in exclude_domains:
            if exclude in domain:
                return False

        # Accept domain if it has reasonable entity name match
        # (simple check - entity name parts appear in domain)
        entity_parts = entity_name.lower().replace(' ', '').replace('-', '')
        domain_parts = domain.lower().replace('.', '').replace('-', '')

        # Accept if domain contains at least part of entity name
        if len(entity_parts) > 3 and entity_parts[:4] in domain_parts:
            return True

        # Accept if it's a .com, .org, .net, or country-specific TLD
        # and has reasonable length
        if len(domain.split('.')) >= 2 and len(domain) > 10:
            tld = domain.split('.')[-1]
            valid_tlds = ['com', 'org', 'net', 'co', 'uk', 'es', 'it', 'de', 'fr', 'ar', 'br']
            if tld in valid_tlds or len(tld) == 2:  # Country codes
                return True

        return False

    async def discover_linkedin_jobs(
        self,
        entity_name: str,
        num_results: int = 3
    ) -> List[str]:
        """
        Discover LinkedIn jobs/careers page for entity

        Args:
            entity_name: Name of the entity
            num_results: Number of search results to check

        Returns:
            List of LinkedIn jobs URLs
        """
        try:
            # Search for LinkedIn jobs
            jobs_query = f'site:linkedin.com "{entity_name}" jobs careers'
            logger.info(f"🔍 Searching for LinkedIn jobs: {jobs_query}")

            jobs_result = await self.brightdata.search_engine(
                jobs_query,
                engine='google',
                num_results=num_results
            )

            linkedin_urls = []

            if jobs_result['status'] == 'success':
                metadata = jobs_result.get('metadata', {})
                source = metadata.get('source', 'unknown')

                if source == 'fallback':
                    logger.warning(f"⚠️ Using fallback results for {entity_name} LinkedIn jobs")
                    return linkedin_urls

                for result in jobs_result['results']:
                    url = result['url']
                    if 'linkedin.com' in url and ('jobs' in url or 'careers' in url):
                        if url not in linkedin_urls:
                            linkedin_urls.append(url)
                            logger.info(f"  ✓ Found LinkedIn jobs: {url}")

            return linkedin_urls

        except Exception as e:
            logger.error(f"❌ Error discovering LinkedIn jobs for {entity_name}: {e}")
            return []

    async def discover_entity_data(
        self,
        entity_id: str,
        entity_name: str,
        binding: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Discover all data for entity (domains, channels, patterns)

        Args:
            entity_id: Entity ID (e.g., "boca_juniors")
            entity_name: Entity name (e.g., "Boca Juniors")
            binding: Existing runtime binding data

        Returns:
            Updated runtime binding
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing: {entity_name} ({entity_id})")
        logger.info(f"{'='*60}")

        # Discover official website
        logger.info("\n📡 Step 1: Discovering official website...")
        discovered_domains = await self.discover_official_website(entity_name)

        # Discover LinkedIn jobs
        logger.info("\n📡 Step 2: Discovering LinkedIn jobs...")
        linkedin_jobs = await self.discover_linkedin_jobs(entity_name)

        # Update binding with discovered data
        binding['discovered_domains'] = discovered_domains
        binding['discovered_channels'] = {
            'linkedin_jobs': linkedin_jobs
        }
        binding['discovered_at'] = datetime.now().isoformat()

        # Log summary
        logger.info(f"\n✅ Discovery complete for {entity_name}:")
        logger.info(f"   - Domains: {len(discovered_domains)}")
        logger.info(f"   - LinkedIn jobs: {len(linkedin_jobs)}")

        return binding

    async def run_discovery(
        self,
        limit: Optional[int] = None,
        entity_filter: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Run discovery pipeline for entities

        Args:
            limit: Maximum number of entities to process (None = all)
            entity_filter: List of specific entity IDs to process (optional)

        Returns:
            Summary statistics
        """
        # Load all binding files
        binding_files = list(self.binding_dir.glob('*.json'))

        if entity_filter:
            # Filter to specific entities
            binding_files = [
                f for f in binding_files
                if f.stem in entity_filter
            ]

        if limit:
            binding_files = binding_files[:limit]

        total_entities = len(binding_files)
        logger.info(f"\n{'='*60}")
        logger.info(f"🚀 Starting discovery for {total_entities} entities")
        logger.info(f"{'='*60}\n")

        stats = {
            'total': total_entities,
            'successful': 0,
            'failed': 0,
            'domains_discovered': 0,
            'channels_discovered': 0,
            'using_fallback': 0
        }

        for idx, binding_file in enumerate(binding_files, 1):
            try:
                # Load existing binding
                with open(binding_file, 'r') as f:
                    binding = json.load(f)

                entity_id = binding['entity_id']
                entity_name = binding['entity_name']

                # Discover data
                updated_binding = await self.discover_entity_data(
                    entity_id, entity_name, binding
                )

                # Check if using fallback
                if not updated_binding['discovered_domains']:
                    metadata = updated_binding.get('metadata', {})
                    # Assume fallback if no domains found
                    if len(updated_binding.get('discovered_domains', [])) == 0:
                        stats['using_fallback'] += 1

                # Save updated binding
                with open(binding_file, 'w') as f:
                    json.dump(updated_binding, f, indent=2)

                # Update statistics
                if updated_binding['discovered_domains']:
                    stats['successful'] += 1
                    stats['domains_discovered'] += len(updated_binding['discovered_domains'])
                else:
                    stats['failed'] += 1

                stats['channels_discovered'] += len(
                    updated_binding.get('discovered_channels', {}).get('linkedin_jobs', [])
                )

                # Progress update
                logger.info(f"\n📊 Progress: [{idx}/{total_entities}]")

                # Rate limiting: 1 request per second to avoid hitting API limits
                if idx < total_entities:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"❌ Failed to process {binding_file.name}: {e}")
                stats['failed'] += 1
                continue

        # Log final statistics
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ Discovery complete!")
        logger.info(f"{'='*60}")
        logger.info(f"Total entities processed: {stats['total']}")
        logger.info(f"Successful: {stats['successful']}")
        logger.info(f"Failed: {stats['failed']}")
        logger.info(f"Using fallback: {stats['using_fallback']}")
        logger.info(f"Total domains discovered: {stats['domains_discovered']}")
        logger.info(f"Total channels discovered: {stats['channels_discovered']}")
        logger.info(f"{'='*60}\n")

        return stats


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Discover runtime binding data with BrightData SDK"
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Maximum number of entities to process (default: all)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Process all entities (same as --limit=None)'
    )
    parser.add_argument(
        '--entities',
        type=str,
        nargs='+',
        default=None,
        help='Specific entity IDs to process (e.g., boca_juniors river_plate)'
    )
    parser.add_argument(
        '--binding-dir',
        type=str,
        default='data/runtime_bindings',
        help='Path to runtime bindings directory'
    )

    args = parser.parse_args()

    # Handle --all flag
    if args.all:
        args.limit = None

    # Initialize discovery orchestrator
    discovery = RuntimeBindingDiscovery(binding_dir=args.binding_dir)

    # Run discovery
    stats = await discovery.run_discovery(
        limit=args.limit,
        entity_filter=args.entities
    )

    # Exit with appropriate code
    if stats['failed'] > stats['successful']:
        exit(1)
    else:
        exit(0)


if __name__ == '__main__':
    asyncio.run(main())
