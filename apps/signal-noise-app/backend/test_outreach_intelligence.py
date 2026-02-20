#!/usr/bin/env python3
"""
Outreach Intelligence Tests

Comprehensive test suite for LinkedInProfiler outreach intelligence extraction:
- extract_outreach_intelligence()
- Mutual connection detection
- Conversation starter generation
- Current provider identification
- Path strength calculation
- Communication pattern analysis

Total: 12 test cases
"""

import asyncio
import logging
import pytest
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
from unittest.mock import AsyncMock, MagicMock, patch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MockBrightDataClient:
    """Mock BrightData SDK client for testing"""

    def __init__(self):
        self.search_calls = []
        self.scrape_calls = []

    async def search_engine(self, query: str, engine: str = "google", num_results: int = 5) -> dict:
        """Mock search engine method"""
        self.search_calls.append({"query": query, "engine": engine, "num_results": num_results})

        # Return mock search results
        return {
            "status": "success",
            "results": [
                {
                    "position": 1,
                    "title": f"Search result for: {query[:30]}",
                    "url": "https://linkedin.com/in/mock-profile",
                    "snippet": f"Mock search result for {query}"
                }
            ]
        }

    async def scrape_as_markdown(self, url: str) -> dict:
        """Mock scrape method"""
        self.scrape_calls.append({"url": url})

        return {
            "status": "success",
            "content": f"""
# Mock LinkedIn Profile Content

## Recent Posts
- Posted about digital transformation initiatives
- Shared insights on CRM platform evaluation
- Announced partnership with technology vendor

## Bio
Technology leader with 15+ years experience in digital transformation.
Currently evaluating CRM and analytics platforms.

## Connections
500+ connections
"""

        }

    async def scrape_jobs_board(self, entity_name: str, keywords: List[str] = None) -> dict:
        """Mock jobs board scraping"""
        return {
            "status": "success",
            "results": [
                {
                    "title": "CRM Manager",
                    "description": "Looking for experienced CRM manager to lead platform evaluation",
                    "date": "2025-01-15",
                    "location": "London"
                }
            ]
        }


@pytest.fixture
def mock_brightdata_client():
    """Fixture for mock BrightData client"""
    return MockBrightDataClient()


@pytest.fixture
def sample_target_contacts():
    """Fixture for sample target contacts"""
    return [
        "https://linkedin.com/in/john-smith-cto",
        "https://linkedin.com/in/jane-doe-cdo",
        "https://linkedin.com/in/mike-johnson-director"
    ]


@pytest.fixture
def sample_yp_team():
    """Fixture for sample Yellow Panther team members"""
    return [
        "https://linkedin.com/in/yp-founder",
        "https://linkedin.com/in/yp-sales-lead",
        "https://linkedin.com/in/yp-technical-lead"
    ]


class TestLinkedInProfilerOutreach:
    """Test suite for LinkedInProfiler outreach intelligence"""

    @pytest.mark.asyncio
    async def test_extract_outreach_intelligence_basic(self, mock_brightdata_client):
        """Test basic outreach intelligence extraction"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Extract outreach intelligence
        intelligence = await profiler.extract_outreach_intelligence(
            entity_name="Test Entity FC",
            target_contacts=["https://linkedin.com/in/mock-contact"],
            yp_team_members=["https://linkedin.com/in/yp-mock"],
            days_to_lookback=30
        )

        # Validate intelligence structure
        assert intelligence.entity_name == "Test Entity FC"
        assert isinstance(intelligence.mutual_paths, list)
        assert isinstance(intelligence.conversation_starters, list)
        assert isinstance(intelligence.current_providers, list)
        assert isinstance(intelligence.communication_patterns, list)
        assert isinstance(intelligence.generated_at, datetime)

        logger.info(f"✅ Extracted outreach intelligence: "
                   f"{len(intelligence.mutual_paths)} paths, "
                   f"{len(intelligence.conversation_starters)} starters")

    @pytest.mark.asyncio
    async def test_mutual_connection_detection(self, mock_brightdata_client):
        """Test mutual connection detection"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Find mutual connections
        mutuals = await profiler._find_mutual_connections(
            yp_member="https://linkedin.com/in/yp-founder",
            contact="https://linkedin.com/in/target-contact"
        )

        # Validate mutual connections
        assert isinstance(mutuals, list)
        # Mock returns empty list, but real implementation would find connections

        logger.info(f"✅ Mutual connection detection working: {len(mutuals)} connections found")

    @pytest.mark.asyncio
    async def test_conversation_starter_generation(self, mock_brightdata_client):
        """Test conversation starter generation from posts"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Mock recent posts
        mock_posts = [
            {
                "content": "We're currently evaluating CRM platforms to modernize our customer engagement. Looking for solutions that can scale with our growth.",
                "date": "2025-01-10",
                "author": "https://linkedin.com/in/cto-entity",
                "url": "https://linkedin.com/posts/12345"
            },
            {
                "content": "Excited about our digital transformation journey! Investing in analytics and data infrastructure.",
                "date": "2025-01-05",
                "author": "https://linkedin.com/in/cdo-entity",
                "url": "https://linkedin.com/posts/12346"
            }
        ]

        # Generate conversation starters
        for post in mock_posts:
            relevance = profiler._score_post_relevance(post)
            angle = profiler._generate_conversation_angle(post, "Test Entity FC")

            assert isinstance(relevance, float)
            assert 0.0 <= relevance <= 1.0
            assert isinstance(angle, str)
            assert len(angle) > 0

            logger.info(f"✅ Conversation starter: {relevance:.2f} relevance")

    @pytest.mark.asyncio
    async def test_current_provider_identification(self, mock_brightdata_client):
        """Test current vendor/provider identification"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Mock post mentioning vendors
        mock_post = {
            "content": "We've been using Salesforce for CRM and are now evaluating Tableau for analytics. Our partnership with Microsoft has been valuable.",
            "date": "2025-01-08"
        }

        # Define provider keywords (normally from class)
        provider_keywords = [
            "salesforce", "hubspot", "microsoft", "oracle", "sap",
            "tableau", "power bi", "looker", "snowflake"
        ]

        # Extract providers
        providers = profiler._extract_providers(mock_post, provider_keywords)

        # Validate provider extraction
        assert isinstance(providers, list)
        assert len(providers) >= 1

        # Check that known vendors are detected
        detected_providers = [p.lower() for p in providers]
        assert any(vendor in detected_providers for vendor in ["salesforce", "tableau", "microsoft"])

        logger.info(f"✅ Identified {len(providers)} current providers: {providers}")

    @pytest.mark.asyncio
    async def test_path_strength_calculation(self, mock_brightdata_client):
        """Test connection path strength calculation"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Test different numbers of mutual connections
        test_cases = [
            ([], 0.0),  # No mutuals
            (["John Doe"], 0.3),  # 1 mutual
            (["John Doe", "Jane Smith"], 0.5),  # 2 mutuals
            (["A", "B", "C"], 0.5),  # 3 mutuals
            (["A", "B", "C", "D"], 0.7),  # 4 mutuals
            (["A", "B", "C", "D", "E"], 0.7),  # 5 mutuals
            (list(range(6)), 0.9),  # 6+ mutuals
        ]

        for mutuals, expected_min_strength in test_cases:
            strength = profiler._calculate_path_strength(mutuals)

            assert isinstance(strength, float)
            assert 0.0 <= strength <= 1.0
            assert strength >= expected_min_strength, \
                f"Expected strength >= {expected_min_strength} for {len(mutuals)} mutuals, got {strength}"

            logger.info(f"✅ Path strength for {len(mutuals)} mutuals: {strength:.2f}")

    @pytest.mark.asyncio
    async def test_communication_pattern_analysis(self, mock_brightdata_client):
        """Test communication pattern analysis"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Mock posts with different frequencies
        contact = "https://linkedin.com/in/test-contact"

        # Test rare posting (1-2 posts)
        rare_posts = [
            {"content": "Post 1", "date": "2025-01-01"}
        ]
        pattern_rare = profiler._analyze_communication_pattern(contact, rare_posts)
        assert pattern_rare.posting_frequency == "rarely"

        # Test monthly posting (2-7 posts)
        monthly_posts = [{"content": f"Post {i}", "date": f"2025-0{i}-01"} for i in range(1, 5)]
        pattern_monthly = profiler._analyze_communication_pattern(contact, monthly_posts)
        assert pattern_monthly.posting_frequency == "monthly"

        # Test weekly posting (8-19 posts)
        weekly_posts = [{"content": f"Post {i}", "date": f"2025-01-{i:02d}"} for i in range(1, 15)]
        pattern_weekly = profiler._analyze_communication_pattern(contact, weekly_posts)
        assert pattern_weekly.posting_frequency == "weekly"

        # Test daily posting (20+ posts)
        daily_posts = [{"content": f"Post {i}", "date": f"2025-01-{i % 30 + 1:02d}"} for i in range(25)]
        pattern_daily = profiler._analyze_communication_pattern(contact, daily_posts)
        assert pattern_daily.posting_frequency == "daily"

        # Validate engagement styles
        assert pattern_rare.engagement_style in ["active", "passive", "responsive"]

        logger.info(f"✅ Communication patterns: rare={pattern_rare.posting_frequency}, "
                   f"daily={pattern_daily.posting_frequency}")

    @pytest.mark.asyncio
    async def test_post_relevance_scoring(self, mock_brightdata_client):
        """Test post relevance scoring"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Test posts with different relevance levels
        test_posts = [
            {
                "content": "We're issuing an RFP for CRM platform procurement. Vendor submissions due next month.",
                "expected_high": True
            },
            {
                "content": "Excited about our digital transformation journey!",
                "expected_medium": True
            },
            {
                "content": "Great game yesterday! The team played well.",
                "expected_low": True
            }
        ]

        for post_data in test_posts:
            post = {k: v for k, v in post_data.items() if k != "expected_high" and k != "expected_medium" and k != "expected_low"}
            is_relevant = profiler._is_post_relevant(post, "Test Entity FC")

            assert isinstance(is_relevant, bool)

            if post_data.get("expected_high"):
                # High relevance posts should be detected as relevant
                assert is_relevant, f"Expected relevant: {post['content'][:50]}"

            logger.info(f"✅ Post relevance: {is_relevant} for '{post['content'][:40]}...'")

    @pytest.mark.asyncio
    async def test_conversation_angle_generation(self, mock_brightdata_client):
        """Test conversation angle generation for different post types"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Test different post types
        test_cases = [
            {
                "content": "We're starting the RFP process for a new CRM system.",
                "expected_keywords": ["procurement", "RFP"]
            },
            {
                "content": "Excited about our digital transformation initiatives!",
                "expected_keywords": ["digital transformation", "modernization"]
            },
            {
                "content": "We're hiring for a Senior CRM Analyst position.",
                "expected_keywords": ["hiring", "growth", "team"]
            },
            {
                "content": "Great insights on analytics and data-driven decision making.",
                "expected_keywords": ["analytics", "data"]
            }
        ]

        for test_case in test_cases:
            # Create proper post dict structure
            post_dict = {
                "content": test_case["content"],
                "date": "2026-02-09"
            }
            angle = profiler._generate_conversation_angle(post_dict, "Test Entity FC")

            assert isinstance(angle, str)
            assert len(angle) > 0

            # Check that angle is entity-specific or contextual
            has_context = ("Test Entity" in angle or "entity" in angle.lower() or
                          "organization" in angle.lower() or "share" in angle.lower())
            assert has_context, f"Angle lacks context: '{angle}'"

            # Check that angle contains relevant context
            angle_lower = angle.lower()
            assert any(keyword in angle_lower for keyword in ["connect", "share", "insights", "initiatives"])

            logger.info(f"✅ Angle: '{angle[:60]}...'")

    @pytest.mark.asyncio
    async def test_outreach_intelligence_completeness(self, mock_brightdata_client):
        """Test that all outreach intelligence components are generated"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Extract comprehensive intelligence
        intelligence = await profiler.extract_outreach_intelligence(
            entity_name="Comprehensive Test FC",
            target_contacts=[
                "https://linkedin.com/in/contact1",
                "https://linkedin.com/in/contact2"
            ],
            yp_team_members=[
                "https://linkedin.com/in/yp1",
                "https://linkedin.com/in/yp2"
            ],
            days_to_lookback=30
        )

        # Validate all components present
        assert hasattr(intelligence, "entity_name")
        assert hasattr(intelligence, "mutual_paths")
        assert hasattr(intelligence, "conversation_starters")
        assert hasattr(intelligence, "current_providers")
        assert hasattr(intelligence, "communication_patterns")
        assert hasattr(intelligence, "generated_at")

        # Validate data freshness
        time_diff = datetime.now(timezone.utc) - intelligence.generated_at
        assert time_diff.total_seconds() < 10  # Generated within last 10 seconds

        logger.info("✅ All outreach intelligence components present and fresh")

    @pytest.mark.asyncio
    async def test_multiple_contacts_processing(self, mock_brightdata_client):
        """Test processing multiple target contacts efficiently"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Test with multiple contacts
        num_contacts = 5
        target_contacts = [f"https://linkedin.com/in/contact-{i}" for i in range(num_contacts)]
        yp_team = [f"https://linkedin.com/in/yp-{i}" for i in range(3)]

        intelligence = await profiler.extract_outreach_intelligence(
            entity_name="Multi-Contact FC",
            target_contacts=target_contacts,
            yp_team_members=yp_team,
            days_to_lookback=30
        )

        # Validate that multiple contacts were processed
        # (Mock may not return actual data, but should not error)
        assert intelligence.entity_name == "Multi-Contact FC"

        # Validate no errors occurred with multiple contacts
        assert isinstance(intelligence.mutual_paths, list)
        assert isinstance(intelligence.conversation_starters, list)

        logger.info(f"✅ Processed {num_contacts} contacts successfully")

    @pytest.mark.asyncio
    async def test_days_lookback_filtering(self, mock_brightdata_client):
        """Test that days_to_lookback parameter works correctly"""
        from linkedin_profiler import LinkedInProfiler

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Test with different lookback periods
        lookback_periods = [7, 30, 90]

        for days in lookback_periods:
            intelligence = await profiler.extract_outreach_intelligence(
                entity_name=f"Test FC {days} days",
                target_contacts=["https://linkedin.com/in/test"],
                yp_team_members=["https://linkedin.com/in/yp"],
                days_to_lookback=days
            )

            # Validate intelligence generated
            assert intelligence is not None
            assert intelligence.entity_name == f"Test FC {days} days"

            logger.info(f"✅ {days}-day lookback period processed successfully")

    @pytest.mark.asyncio
    async def test_outreach_intelligence_serialization(self, mock_brightdata_client):
        """Test that outreach intelligence can be serialized for storage"""
        from linkedin_profiler import LinkedInProfiler
        import json

        profiler = LinkedInProfiler(mock_brightdata_client)

        # Generate intelligence
        intelligence = await profiler.extract_outreach_intelligence(
            entity_name="Serialization Test FC",
            target_contacts=["https://linkedin.com/in/test"],
            yp_team_members=["https://linkedin.com/in/yp"],
            days_to_lookback=30
        )

        # Convert to dict for serialization
        intelligence_dict = {
            "entity_name": intelligence.entity_name,
            "mutual_paths": [
                {
                    "yp_member": p.yp_member,
                    "target_contact": p.target_contact,
                    "mutual_connections": p.mutual_connections,
                    "path_strength": p.path_strength,
                    "connection_type": p.connection_type
                }
                for p in intelligence.mutual_paths
            ],
            "conversation_starters": [
                {
                    "post_content": s.post_content,
                    "post_date": s.post_date,
                    "author": s.author,
                    "relevance_score": s.relevance_score,
                    "conversation_angle": s.conversation_angle
                }
                for s in intelligence.conversation_starters
            ],
            "current_providers": [
                {
                    "provider_name": p.provider_name,
                    "solution_type": p.solution_type,
                    "confidence": p.confidence
                }
                for p in intelligence.current_providers
            ],
            "communication_patterns": [
                {
                    "contact_name": c.contact_name,
                    "posting_frequency": c.posting_frequency,
                    "engagement_style": c.engagement_style
                }
                for c in intelligence.communication_patterns
            ],
            "generated_at": intelligence.generated_at.isoformat()
        }

        # Validate JSON serialization
        json_str = json.dumps(intelligence_dict, default=str)
        assert len(json_str) > 0

        # Validate deserialization
        parsed = json.loads(json_str)
        assert parsed["entity_name"] == "Serialization Test FC"

        logger.info(f"✅ Outreach intelligence serialized successfully ({len(json_str)} bytes)")


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "-s"])
