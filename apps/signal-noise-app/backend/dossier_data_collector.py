#!/usr/bin/env python3
"""
Dossier Data Collector

Integrates multiple data sources for entity dossier generation:
- FalkorDB for entity metadata (name, sport, country, league, etc.)
- BrightData SDK for live web scraping (recent news, official site content)
- Hypothesis Manager for discovered signals (procurement patterns)

Usage:
    from dossier_data_collector import DossierDataCollector

    collector = DossierDataCollector()
    data = await collector.collect_all(entity_id="arsenal-fc", entity_name="Arsenal FC")
"""

import os
import logging
import urllib.parse
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path

# Load environment variables from .env (same pattern as graphiti_service.py)
project_root = Path(__file__).parent.parent
env_files = [
    project_root / '.env.local',
    project_root / '.env',
    Path('.env.local'),
    Path('.env')
]

for env_file in env_files:
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            break
        except ImportError:
            # Fallback: manual parsing
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()
            break

logger = logging.getLogger(__name__)


# =============================================================================
# Data Structures
# =============================================================================

@dataclass
class EntityMetadata:
    """Entity metadata from FalkorDB"""
    entity_id: str
    entity_name: str
    entity_type: str  # CLUB, LEAGUE, VENUE, PERSON
    sport: Optional[str] = None
    country: Optional[str] = None
    league_or_competition: Optional[str] = None
    ownership_type: Optional[str] = None
    org_type: Optional[str] = None
    estimated_revenue_band: Optional[str] = None
    digital_maturity: Optional[str] = None
    description: Optional[str] = None

    # Additional properties from web scraping (Phase 2)
    founded: Optional[str] = None  # Year founded (e.g., "1886")
    stadium: Optional[str] = None  # Stadium/venue name
    capacity: Optional[str] = None  # Stadium capacity
    website: Optional[str] = None  # Official website URL
    employees: Optional[str] = None  # Employee count

    # Metadata about source
    data_source: str = "FalkorDB"
    retrieved_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ScrapedContent:
    """Content scraped from web sources"""
    url: str
    source_type: str  # OFFICIAL_SITE, CAREERS_PAGE, PRESS_RELEASE, etc.
    title: Optional[str] = None
    content: str = ""
    markdown_content: str = ""
    published_at: Optional[datetime] = None
    scraped_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    word_count: int = 0


@dataclass
class HypothesisSignal:
    """Signal discovered by Hypothesis Manager"""
    hypothesis_id: str
    category: str
    statement: str
    confidence: float
    status: str  # ACTIVE, PROMOTED, DEGRADED, SATURATED
    evidence_count: int
    discovered_at: datetime
    last_evidence: Optional[str] = None

    # Metadata
    reinforced_count: int = 0
    iterations_attempted: int = 0


@dataclass
class DossierData:
    """Complete data package for dossier generation"""
    entity_id: str
    entity_name: str

    # Data sources
    metadata: Optional[EntityMetadata] = None
    scraped_content: List[ScrapedContent] = field(default_factory=list)
    hypothesis_signals: List[HypothesisSignal] = field(default_factory=list)

    # Collection metadata
    collected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    data_sources_used: List[str] = field(default_factory=list)


# =============================================================================
# Data Collector Implementation
# =============================================================================

class DossierDataCollector:
    """
    Collect entity data from multiple sources for dossier generation

    Uses same .env loading pattern as graphiti_service.py for consistency.
    """

    def __init__(self, falkordb_client=None, brightdata_client=None, hypothesis_manager=None):
        """
        Initialize data collector

        Args:
            falkordb_client: Optional FalkorDB client (will create if None)
            brightdata_client: Optional BrightData SDK client (will create if None)
            hypothesis_manager: Optional HypothesisManager (will create if None)
        """
        self.falkordb_client = falkordb_client
        self.brightdata_client = brightdata_client
        self.hypothesis_manager = hypothesis_manager

        self._falkordb_connected = False
        self._brightdata_available = False
        self._hypothesis_available = False

    async def _connect_falkordb(self):
        """Connect to FalkorDB using native Python client"""
        if self._falkordb_connected:
            return True

        try:
            from falkordb import FalkorDB

            # Load from environment (already loaded in module header)
            uri = os.getenv("FALKORDB_URI")
            username = os.getenv("FALKORDB_USER", "falkordb")
            password = os.getenv("FALKORDB_PASSWORD")
            database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

            if not uri:
                logger.warning("⚠️ FALKORDB_URI not set - FalkorDB integration disabled")
                return False

            # Parse host and port from URI
            parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
            host = parsed.hostname or "localhost"
            port = parsed.port or 6379

            logger.info(f"🔗 Connecting to FalkorDB at {host}:{port}...")

            # Connect
            self.falkordb_client = FalkorDB(
                host=host,
                port=port,
                username=username,
                password=password,
                ssl=True
            )

            # Test connection
            g = self.falkordb_client.select_graph(database)
            g.query("RETURN 1 AS test")

            self._falkordb_connected = True
            logger.info("✅ FalkorDB connected")
            return True

        except ImportError:
            logger.warning("⚠️ falkordb not installed - FalkorDB integration disabled")
            return False
        except Exception as e:
            logger.error(f"❌ FalkorDB connection failed: {e}")
            return False

    async def collect_all(self, entity_id: str, entity_name: str = None) -> DossierData:
        """
        Collect all available data for dossier generation

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            DossierData with all collected information
        """
        logger.info(f"🔍 Collecting dossier data for {entity_name or entity_id}")

        # Connect to all data sources
        await self._connect_falkordb()
        await self._connect_brightdata()

        dossier_data = DossierData(
            entity_id=entity_id,
            entity_name=entity_name or entity_id.replace("-", " ").title()
        )

        # Collect entity metadata from FalkorDB
        if self._falkordb_connected:
            metadata = await self._get_entity_metadata(entity_id)
            if metadata:
                dossier_data.metadata = metadata
                dossier_data.data_sources_used.append("FalkorDB")
        else:
            # Create basic metadata if FalkorDB unavailable
            logger.info("📝 Creating basic metadata (FalkorDB unavailable)")
            dossier_data.metadata = EntityMetadata(
                entity_id=entity_id,
                entity_name=entity_name or entity_id.replace("-", " ").title(),
                entity_type="CLUB",
                data_source="Generated"
            )

        # Scrape additional data from web (Phase 2)
        if self._brightdata_available:
            scrape_result = await self._get_scraped_content(entity_id, dossier_data.entity_name)

            if scrape_result:
                scraped_content, extracted_data = scrape_result

                # Add scraped content to dossier
                dossier_data.scraped_content.append(scraped_content)
                dossier_data.data_sources_used.append("BrightData")

                # Update metadata with scraped properties
                if dossier_data.metadata and extracted_data:
                    if extracted_data.get('founded'):
                        dossier_data.metadata.founded = extracted_data['founded']
                    if extracted_data.get('stadium'):
                        dossier_data.metadata.stadium = extracted_data['stadium']
                    if extracted_data.get('capacity'):
                        dossier_data.metadata.capacity = extracted_data['capacity']
                    if extracted_data.get('website'):
                        dossier_data.metadata.website = extracted_data['website']
                    if extracted_data.get('employees'):
                        dossier_data.metadata.employees = extracted_data['employees']
                    if extracted_data.get('league'):
                        dossier_data.metadata.league_or_competition = extracted_data['league']
                    if extracted_data.get('country'):
                        dossier_data.metadata.country = extracted_data['country']

                    logger.info(f"✅ Enhanced metadata with BrightData data")

        logger.info(f"✅ Collected data from {len(dossier_data.data_sources_used)} sources")
        return dossier_data

    async def _get_entity_metadata(self, entity_id: str) -> Optional[EntityMetadata]:
        """
        Get entity metadata from FalkorDB

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")

        Returns:
            EntityMetadata object or None if not found
        """
        if not self.falkordb_client or not self._falkordb_connected:
            logger.warning("No FalkorDB client available")
            return None

        try:
            database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")
            g = self.falkordb_client.select_graph(database)

            # Query entity metadata (matches schema from load_all_entities.py)
            cypher = """
            MATCH (e:Entity {entity_id: $entity_id})
            RETURN
                e.entity_id as entity_id,
                e.name as name,
                e.sport as sport,
                e.country as country,
                e.league_or_competition as league_or_competition,
                e.ownership_type as ownership_type,
                e.org_type as org_type,
                e.estimated_revenue_band as estimated_revenue_band,
                e.digital_maturity as digital_maturity,
                e.description as description
            """

            result = g.query(cypher, {"entity_id": entity_id})

            if result.result_set:
                row = result.result_set[0]
                return EntityMetadata(
                    entity_id=row[0] or entity_id,
                    entity_name=row[1] or entity_id.replace("-", " ").title(),
                    entity_type=row[7] or "CLUB",  # org_type
                    sport=row[2],
                    country=row[3],
                    league_or_competition=row[4],
                    ownership_type=row[5],
                    org_type=row[7],
                    estimated_revenue_band=row[6],
                    digital_maturity=row[8],
                    description=row[9]
                )
            else:
                logger.warning(f"⚠️ No metadata found for {entity_id} in FalkorDB")
                return None

        except Exception as e:
            logger.error(f"❌ FalkorDB metadata query failed: {e}")
            return None

    async def _connect_brightdata(self):
        """Initialize BrightData SDK client"""
        if self._brightdata_available:
            return True

        try:
            from brightdata_sdk_client import BrightDataSDKClient

            self.brightdata_client = BrightDataSDKClient()

            # Test connection with a simple search
            test_result = await self.brightdata_client.search_engine(
                query="test",
                engine="google",
                num_results=1
            )

            if test_result.get('status') == 'success':
                self._brightdata_available = True
                logger.info("✅ BrightData SDK connected")
                return True
            else:
                logger.warning("⚠️ BrightData SDK test failed")
                return False

        except ImportError:
            logger.warning("⚠️ brightdata_sdk_client not installed - web scraping disabled")
            return False
        except Exception as e:
            logger.error(f"❌ BrightData SDK connection failed: {e}")
            return False

    async def _get_scraped_content(self, entity_id: str, entity_name: str) -> Optional[ScrapedContent]:
        """
        Scrape official website for entity details

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            ScrapedContent with entity details or None
        """
        if not self._brightdata_available or not self.brightdata_client:
            logger.warning("BrightData not available for scraping")
            return None

        try:
            # Step 1: Search for official website
            logger.info(f"🔍 Searching for official website: {entity_name}")
            search_results = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" official website',
                engine="google",
                num_results=5
            )

            if search_results.get('status') != 'success':
                logger.warning(f"Search failed for {entity_name}")
                return None

            results = search_results.get('results', [])
            if not results:
                logger.warning(f"No search results for {entity_name}")
                return None

            # Step 2: Find official website URL
            official_url = None
            for result in results[:5]:
                url = result.get('url', '')
                title = result.get('title', '').lower()
                snippet = result.get('snippet', '').lower()

                # Look for official site indicators
                if (entity_name.lower().replace(' ', '') in url.lower() or
                    'official' in title or 'official' in snippet or
                    '.com' in url and 'wikipedia' not in url and 'espn' not in url):
                    official_url = url
                    logger.info(f"✅ Found official website: {official_url}")
                    break

            if not official_url:
                # Fallback: use first result
                official_url = results[0].get('url', '')
                logger.info(f"⚠️ Using fallback URL: {official_url}")

            # Step 3: Scrape official website content
            logger.info(f"📄 Scraping content from {official_url}")
            scrape_result = await self.brightdata_client.scrape_as_markdown(official_url)

            if scrape_result.get('status') != 'success':
                logger.warning(f"Scraping failed for {official_url}")
                return None

            content = scrape_result.get('content', '')
            if not content:
                logger.warning(f"No content scraped from {official_url}")
                return None

            # Step 4: Extract entity properties using AI
            extracted_data = await self._extract_entity_properties(content, entity_name)

            scraped_content = ScrapedContent(
                url=official_url,
                source_type="OFFICIAL_SITE",
                title=entity_name,
                content=content[:5000],  # Store first 5000 chars
                markdown_content=content,
                word_count=len(content.split())
            )

            logger.info(f"✅ Scraped {len(content)} chars from {official_url}")
            logger.info(f"   Extracted properties: {list(extracted_data.keys())}")

            # Merge scraped data into metadata
            return scraped_content, extracted_data

        except Exception as e:
            logger.error(f"❌ Web scraping failed: {e}")
            return None

    async def _extract_entity_properties(self, content: str, entity_name: str) -> Dict[str, Any]:
        """
        Extract entity properties from scraped content using Claude AI

        Args:
            content: Scraped markdown content
            entity_name: Name of the entity

        Returns:
            Dictionary with extracted properties
        """
        try:
            from claude_client import ClaudeClient

            client = ClaudeClient()

            prompt = f"""Extract the following information from this website content about {entity_name}:

Website Content (first 3000 chars):
{content[:3000]}

Extract and return ONLY a JSON object with these fields:
{{
  "founded": "Year founded (e.g., 1886)",
  "stadium": "Stadium or venue name (e.g., Emirates Stadium)",
  "capacity": "Stadium capacity (e.g., 60,704)",
  "website": "Official website URL",
  "employees": "Number of employees if mentioned",
  "league": "League or competition name",
  "country": "Country"
}}

If a field is not found, use null. Return ONLY valid JSON, no other text."""

            result = await client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=500
            )

            response_text = result.get('content', '')

            # Parse JSON response
            import json
            import re

            # Extract JSON from response
            json_match = re.search(r'\{[^{}]*"fought"[^{}]*\}', response_text, re.DOTALL)
            if not json_match:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)

            if json_match:
                extracted = json.loads(json_match.group(0))
                logger.info(f"✅ Extracted properties: {extracted}")
                return extracted
            else:
                logger.warning("Could not parse extraction response")
                return {}

        except Exception as e:
            logger.error(f"❌ Property extraction failed: {e}")
            return {}

    async def _collect_multi_source_intelligence(
        self,
        entity_name: str
    ) -> Dict[str, Any]:
        """
        Collect real-time intelligence from multiple sources using BrightData SDK.

        Args:
            entity_name: Name of the entity to research

        Returns:
            Dict with:
            - official_site: Scraped official website content
            - job_postings: Recent relevant job postings (CRM, Digital, Data)
            - press_releases: Recent press releases and news
            - linkedin_posts: LinkedIn activity (if available via scraping)
            - sources_used: List of successfully accessed sources
            - freshness_score: Overall data freshness score (0-100)
        """
        # Ensure BrightData is connected
        if not self._brightdata_available:
            connected = await self._connect_brightdata()
            if not connected or not self.brightdata_client:
                logger.warning("BrightData not available for multi-source collection")
                return {
                    "official_site": {},
                    "job_postings": [],
                    "press_releases": [],
                    "linkedin_posts": [],
                    "sources_used": [],
                    "freshness_score": 0
                }

        logger.info(f"🔍 Collecting multi-source intelligence for {entity_name}")

        results = {
            "official_site": {},
            "job_postings": [],
            "press_releases": [],
            "linkedin_posts": [],
            "sources_used": [],
            "freshness_score": 0
        }

        # Source 1: Official website
        try:
            logger.info(f"📄 Scraping official website for {entity_name}")
            site_result = await self._scrape_official_site(entity_name)
            if site_result:
                results["official_site"] = site_result
                results["sources_used"].append("official_website")
                logger.info(f"✅ Official website scraped: {site_result.get('url')}")
        except Exception as e:
            logger.warning(f"⚠️ Official website scraping failed: {e}")

        # Source 2: Job postings (digital/tech roles)
        try:
            logger.info(f"💼 Scraping job postings for {entity_name}")
            jobs_result = await self.brightdata_client.scrape_jobs_board(
                entity_name=entity_name,
                keywords=["CRM", "Digital", "Data", "Analytics", "Marketing", "Technology", "CRM", "Cloud"]
            )
            if jobs_result.get('status') == 'success':
                jobs = jobs_result.get('results', [])[:10]  # Limit to 10 most recent
                results["job_postings"] = jobs
                results["sources_used"].append("job_postings")
                logger.info(f"✅ Found {len(jobs)} relevant job postings")
        except Exception as e:
            logger.warning(f"⚠️ Job posting scraping failed: {e}")

        # Source 3: Press releases and news
        try:
            logger.info(f"📰 Scraping press releases for {entity_name}")
            press_result = await self.brightdata_client.scrape_press_release(entity_name=entity_name)
            if press_result.get('status') == 'success':
                press = press_result.get('results', [])[:10]  # Limit to 10 most recent
                results["press_releases"] = press
                results["sources_used"].append("press_releases")
                logger.info(f"✅ Found {len(press)} press releases")
        except Exception as e:
            logger.warning(f"⚠️ Press release scraping failed: {e}")

        # Source 4: LinkedIn (company page and posts)
        try:
            logger.info(f"💼 Searching LinkedIn for {entity_name}")
            linkedin_search = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" site:linkedin.com/company',
                engine='google',
                num_results=5
            )
            if linkedin_search.get('status') == 'success':
                linkedin_results = linkedin_search.get('results', [])
                results["linkedin_posts"] = linkedin_results
                results["sources_used"].append("linkedin")
                logger.info(f"✅ Found {len(linkedin_results)} LinkedIn references")
        except Exception as e:
            logger.warning(f"⚠️ LinkedIn scraping failed: {e}")

        # Calculate freshness score based on recency and source count
        freshness_score = self._calculate_freshness_score(results)
        results["freshness_score"] = freshness_score

        logger.info(f"✅ Multi-source collection complete: {len(results['sources_used'])} sources, freshness: {freshness_score}/100")

        return results

    async def _scrape_official_site(self, entity_name: str) -> Optional[Dict[str, Any]]:
        """
        Scrape official website for entity details

        Args:
            entity_name: Entity name to search for

        Returns:
            Dict with url, content, summary, and metadata
        """
        if not self._brightdata_available or not self.brightdata_client:
            return None

        try:
            # Search for official website
            search_results = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" official website',
                engine="google",
                num_results=5
            )

            if search_results.get('status') != 'success':
                return None

            results = search_results.get('results', [])
            if not results:
                return None

            # Find official website URL
            official_url = None
            for result in results[:5]:
                url = result.get('url', '')
                title = result.get('title', '').lower()
                snippet = result.get('snippet', '').lower()

                if (entity_name.lower().replace(' ', '') in url.lower() or
                    'official' in title or 'official' in snippet or
                    '.com' in url and 'wikipedia' not in url and 'espn' not in url):
                    official_url = url
                    break

            if not official_url:
                official_url = results[0].get('url', '')

            # Scrape official website content
            scrape_result = await self.brightdata_client.scrape_as_markdown(official_url)

            if scrape_result.get('status') != 'success':
                return None

            content = scrape_result.get('content', '')
            if not content:
                return None

            # Generate summary (first 500 chars)
            summary = content[:500] + "..." if len(content) > 500 else content

            return {
                "url": official_url,
                "content": content,
                "summary": summary,
                "word_count": len(content.split()),
                "source": "official_website",
                "context": "Official website provides current technology stack, vendor mentions, and strategic messaging",
                "freshness": "real-time",
                "confidence_explanation": "Directly from entity's official communications"
            }

        except Exception as e:
            logger.error(f"❌ Official site scraping failed: {e}")
            return None

    def _calculate_freshness_score(self, results: Dict[str, Any]) -> int:
        """
        Calculate data freshness score based on sources and recency

        Args:
            results: Multi-source collection results

        Returns:
            Freshness score (0-100)
        """
        score = 0

        # Base score from number of sources
        sources_count = len(results.get('sources_used', []))
        score += sources_count * 20  # Each source = 20 points

        # Bonus for having job postings (indicates active hiring/changes)
        jobs = results.get('job_postings', [])
        if jobs:
            score += 10

        # Bonus for having press releases (indicates recent news)
        press = results.get('press_releases', [])
        if press:
            score += 10

        # Bonus for LinkedIn (indicates active social presence)
        linkedin = results.get('linkedin_posts', [])
        if linkedin:
            score += 10

        return min(score, 100)  # Cap at 100

    async def _connect_hypothesis_manager(self):
        """Initialize Hypothesis Manager (for Phase 3)"""
        # Placeholder for Phase 3 implementation
        return False


# =============================================================================
# Convenience Functions
# =============================================================================

async def collect_dossier_data(entity_id: str, entity_name: str = None) -> DossierData:
    """
    Convenience function to collect all dossier data

    Usage:
        from dossier_data_collector import collect_dossier_data

        data = await collect_dossier_data("arsenal-fc", "Arsenal FC")
        print(f"Metadata: {data.metadata}")
        print(f"Sources: {data.data_sources_used}")
    """
    collector = DossierDataCollector()
    return await collector.collect_all(entity_id, entity_name)


# =============================================================================
# Test / Main
# =============================================================================

async def test_falkordb_integration():
    """Test FalkorDB integration with Arsenal FC"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    print("\n" + "=" * 70)
    print("PHASE 1: FALKORDB INTEGRATION TEST")
    print("=" * 70)

    collector = DossierDataCollector()
    data = await collector.collect_all(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC"
    )

    print("\n📊 Collection Results:")
    print(f"  Entity: {data.entity_name} ({data.entity_id})")
    print(f"  Data Sources: {', '.join(data.data_sources_used)}")
    print(f"  Collected At: {data.collected_at}")

    if data.metadata:
        print(f"\n✅ FalkorDB Metadata:")
        print(f"  Entity ID: {data.metadata.entity_id}")
        print(f"  Name: {data.metadata.entity_name}")
        print(f"  Type: {data.metadata.entity_type}")
        print(f"  Sport: {data.metadata.sport}")
        print(f"  Country: {data.metadata.country}")
        print(f"  League: {data.metadata.league_or_competition}")
        print(f"  Ownership: {data.metadata.ownership_type}")
        print(f"  Revenue Band: {data.metadata.estimated_revenue_band}")
        print(f"  Digital Maturity: {data.metadata.digital_maturity}")
        if data.metadata.description:
            desc = data.metadata.description[:100] + "..." if len(data.metadata.description) > 100 else data.metadata.description
            print(f"  Description: {desc}")
    else:
        print("\n❌ No metadata retrieved")

    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)

    # Return success status
    return data.metadata is not None


if __name__ == "__main__":
    import asyncio
    success = asyncio.run(test_falkordb_integration())
    exit(0 if success else 1)
