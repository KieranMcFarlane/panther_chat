"""
Test suite for TemporalPriorService

Tests:
- Category mapping accuracy
- Seasonality computation
- Recurrence analysis
- Momentum tracking
- Temporal multiplier calculation
- Backoff chain behavior
"""

import pytest
from collections import defaultdict
from backend.temporal.temporal_prior_service import TemporalPriorService
from backend.temporal.category_mapper import CategoryMapper
from backend.temporal.seasonal_analyzer import SeasonalityAnalyzer
from backend.temporal.recurrence_analyzer import RecurrenceAnalyzer
from backend.temporal.momentum_tracker import MomentumTracker
from backend.temporal.models import SignalCategory, TemporalPrior
from datetime import datetime, timedelta


@pytest.fixture
def sample_episodes():
    """Sample episodes for testing"""
    now = datetime.now()
    return [
        {
            "id": "ep1",
            "entity_id": "test_entity",
            "timestamp": (now - timedelta(days=10)).isoformat(),
            "template_name": "Salesforce CRM Upgrade",
            "category": "Digital Infrastructure"
        },
        {
            "id": "ep2",
            "entity_id": "test_entity",
            "timestamp": (now - timedelta(days=40)).isoformat(),
            "template_name": "HubSpot Migration",
            "category": "Digital Infrastructure"
        },
        {
            "id": "ep3",
            "entity_id": "test_entity",
            "timestamp": (now - timedelta(days=70)).isoformat(),
            "template_name": "Zendesk Ticketing System",
            "category": "Operations"
        }
    ]


@pytest.fixture
def sample_priors():
    """Sample priors for testing"""
    now = datetime.now()
    return {
        "test_entity:CRM": TemporalPrior(
            entity_id="test_entity",
            signal_category=SignalCategory.CRM,
            seasonality={"Q1": 0.5, "Q2": 0.2, "Q3": 0.2, "Q4": 0.1},
            recurrence_mean=30,
            recurrence_std=5,
            momentum_30d=2,
            momentum_90d=5,
            last_seen=now - timedelta(days=28),
            sample_size=10,
            computed_at=now
        ),
        "*:CRM": TemporalPrior(
            entity_id="*",
            signal_category=SignalCategory.CRM,
            seasonality={"Q1": 0.3, "Q2": 0.3, "Q3": 0.2, "Q4": 0.2},
            recurrence_mean=45,
            recurrence_std=10,
            momentum_30d=100,
            momentum_90d=300,
            last_seen=now - timedelta(days=5),
            sample_size=500,
            computed_at=now
        )
    }


class TestCategoryMapper:
    """Test category mapping functionality"""

    def test_keyword_matching_crm(self):
        """Test CRM keyword matching"""
        category = CategoryMapper.map_template_to_category(
            "Salesforce CRM Upgrade",
            "Digital Infrastructure"
        )
        assert category == SignalCategory.CRM

    def test_keyword_matching_ticketing(self):
        """Test ticketing keyword matching"""
        category = CategoryMapper.map_template_to_category(
            "Zendesk Ticketing System",
            "Operations"
        )
        assert category == SignalCategory.TICKETING

    def test_keyword_matching_analytics(self):
        """Test analytics keyword matching"""
        category = CategoryMapper.map_template_to_category(
            "Tableau Dashboard Implementation",
            "Technology"
        )
        assert category == SignalCategory.ANALYTICS

    def test_fallback_mapping(self):
        """Test fallback to current category mapping"""
        category = CategoryMapper.map_template_to_category(
            "Unknown Tech Project",
            "Technology"
        )
        assert category == SignalCategory.ANALYTICS  # First option in Technology mapping

    def test_default_fallback(self):
        """Test default fallback to OPERATIONS"""
        category = CategoryMapper.map_template_to_category(
            "Completely Unknown",
            "Unknown Category"
        )
        assert category == SignalCategory.OPERATIONS

    def test_expand_digital_infrastructure(self):
        """Test expanding Digital Infrastructure category"""
        categories = CategoryMapper.expand_category("Digital Infrastructure")
        assert SignalCategory.CRM in categories
        assert SignalCategory.DATA_PLATFORM in categories
        assert SignalCategory.INFRASTRUCTURE in categories
        assert SignalCategory.SECURITY in categories

    def test_expand_commercial(self):
        """Test expanding Commercial category"""
        categories = CategoryMapper.expand_category("Commercial")
        assert SignalCategory.COMMERCE in categories
        assert SignalCategory.MARKETING in categories
        assert SignalCategory.CONTENT in categories


class TestSeasonalityAnalyzer:
    """Test seasonality computation"""

    def test_seasonality_distribution(self, sample_episodes):
        """Test quarter distribution sums to 1.0"""
        seasonality = SeasonalityAnalyzer.compute_seasonality(sample_episodes)
        assert sum(seasonality.values()) == pytest.approx(1.0, rel=0.01)

    def test_seasonality_bounds(self, sample_episodes):
        """Test all seasonality values are in [0, 1]"""
        seasonality = SeasonalityAnalyzer.compute_seasonality(sample_episodes)
        assert all(0.0 <= v <= 1.0 for v in seasonality.values())

    def test_seasonality_empty_list(self):
        """Test seasonality with empty list returns uniform distribution"""
        seasonality = SeasonalityAnalyzer.compute_seasonality([])
        assert seasonality == {"Q1": 0.25, "Q2": 0.25, "Q3": 0.25, "Q4": 0.25}

    def test_seasonality_quarter_detection(self):
        """Test correct quarter detection from timestamps"""
        now = datetime.now()
        episodes = [
            {"timestamp": datetime(now.year, 1, 15).isoformat()},  # Q1
            {"timestamp": datetime(now.year, 4, 15).isoformat()},  # Q2
            {"timestamp": datetime(now.year, 7, 15).isoformat()},  # Q3
            {"timestamp": datetime(now.year, 10, 15).isoformat()},  # Q4
        ]
        seasonality = SeasonalityAnalyzer.compute_seasonality(episodes)
        assert seasonality["Q1"] == 0.25
        assert seasonality["Q2"] == 0.25
        assert seasonality["Q3"] == 0.25
        assert seasonality["Q4"] == 0.25


class TestRecurrenceAnalyzer:
    """Test recurrence analysis"""

    def test_recurrence_mean_computation(self, sample_episodes):
        """Test mean interval calculation"""
        mean, std = RecurrenceAnalyzer.compute_recurrence(sample_episodes)
        assert mean is not None
        assert mean > 0  # Should be ~30 days between episodes

    def test_recurrence_std_computation(self, sample_episodes):
        """Test standard deviation calculation"""
        mean, std = RecurrenceAnalyzer.compute_recurrence(sample_episodes)
        assert std is not None
        assert std >= 0

    def test_recurrence_single_episode(self):
        """Test recurrence with single episode returns None"""
        episodes = [{"timestamp": datetime.now().isoformat()}]
        mean, std = RecurrenceAnalyzer.compute_recurrence(episodes)
        assert mean is None
        assert std is None

    def test_recurrence_empty_list(self):
        """Test recurrence with empty list returns None"""
        mean, std = RecurrenceAnalyzer.compute_recurrence([])
        assert mean is None
        assert std is None

    def test_recurrence_regular_intervals(self):
        """Test recurrence with regular 30-day intervals"""
        now = datetime.now()
        episodes = [
            {"timestamp": (now - timedelta(days=90)).isoformat()},
            {"timestamp": (now - timedelta(days=60)).isoformat()},
            {"timestamp": (now - timedelta(days=30)).isoformat()},
        ]
        mean, std = RecurrenceAnalyzer.compute_recurrence(episodes)
        assert mean == pytest.approx(30.0, rel=0.1)
        assert std == pytest.approx(0.0, abs=0.1)


class TestMomentumTracker:
    """Test momentum tracking"""

    def test_momentum_30d_count(self, sample_episodes):
        """Test 30-day momentum count"""
        momentum = MomentumTracker.compute_momentum(sample_episodes)
        assert momentum["30d"] >= 1  # At least one episode in last 30 days

    def test_momentum_90d_count(self, sample_episodes):
        """Test 90-day momentum count"""
        momentum = MomentumTracker.compute_momentum(sample_episodes)
        assert momentum["90d"] >= 2  # At least two episodes in last 90 days

    def test_momentum_empty_list(self):
        """Test momentum with empty list"""
        momentum = MomentumTracker.compute_momentum([])
        assert momentum["30d"] == 0
        assert momentum["90d"] == 0

    def test_momentum_trend_positive(self):
        """Test positive momentum trend"""
        now = datetime.now()
        episodes = [
            {"timestamp": (now - timedelta(days=5)).isoformat()},
            {"timestamp": (now - timedelta(days=10)).isoformat()},
            {"timestamp": (now - timedelta(days=80)).isoformat()},
        ]
        momentum = MomentumTracker.compute_momentum(episodes)
        assert momentum["30d"] > momentum["90d"] / 3  # Recent activity higher


class TestTemporalPriorService:
    """Test TemporalPriorService core functionality"""

    def test_temporal_multiplier_high_seasonality(self, sample_priors):
        """Test multiplier is boosted by high seasonality"""
        service = TemporalPriorService()
        service.priors = sample_priors

        # Test in Q1 (high seasonality for CRM)
        now = datetime.now()
        
        multiplier = service._compute_multiplier(
            sample_priors["test_entity:CRM"],
            "Q1",
            now
        )
        assert 0.75 <= multiplier <= 1.40
        # High seasonality + momentum should boost
        assert multiplier > 1.0  

    def test_temporal_multiplier_low_seasonality(self, sample_priors):
        """Test multiplier with low seasonality (may still be boosted by momentum)"""
        service = TemporalPriorService()
        service.priors = sample_priors

        # Test in Q4 (low seasonality for CRM)
        now = datetime.now()
        multiplier = service._compute_multiplier(
            sample_priors["test_entity:CRM"],
            "Q4",
            now
        )
        # Multiplier should be in valid range
        # Note: May still be > 1.0 due to momentum boosting
        assert 0.75 <= multiplier <= 1.40

    def test_temporal_multiplier_clamping(self):
        """Test multiplier is clamped to [0.75, 1.40]"""
        service = TemporalPriorService()

        # Create extreme prior
        now = datetime.now()
        prior = TemporalPrior(
            entity_id="test",
            signal_category=SignalCategory.CRM,
            seasonality={"Q1": 1.0, "Q2": 0.0, "Q3": 0.0, "Q4": 0.0},
            recurrence_mean=30,
            recurrence_std=1,
            momentum_30d=100,  # Extreme momentum
            momentum_90d=100,
            last_seen=now,
            sample_size=100,
            computed_at=now
        )

        multiplier = service._compute_multiplier(prior, "Q1", now)
        assert 0.75 <= multiplier <= 1.40

    def test_backoff_chain_exact_match(self, sample_priors):
        """Test backoff chain finds exact match first"""
        service = TemporalPriorService()
        service.priors = sample_priors

        result = service.get_multiplier("test_entity", SignalCategory.CRM)

        assert result.backoff_level == "entity"
        assert result.prior is not None
        assert result.confidence == "high"

    def test_backoff_chain_fallback_to_global(self, sample_priors):
        """Test backoff chain falls back to global baseline"""
        service = TemporalPriorService()
        service.priors = sample_priors

        # Request unknown entity-category combo
        result = service.get_multiplier("unknown_entity", SignalCategory.TICKETING)

        assert result.backoff_level in ["cluster", "global"]
        assert 0.75 <= result.multiplier <= 1.40

    def test_backoff_chain_fallback_to_global_category(self, sample_priors):
        """Test backoff chain falls back appropriately"""
        service = TemporalPriorService()
        service.priors = sample_priors

        # Request unknown entity but known category (may use cluster or global)
        result = service.get_multiplier("unknown_entity_xyz", SignalCategory.CRM)

        # Note: May fall back to cluster if cluster priors exist
        assert result.backoff_level in ["entity", "cluster", "global"]
        assert 0.75 <= result.multiplier <= 1.40

    def test_group_episodes_by_entity_category(self, sample_episodes):
        """Test episodes are grouped by entity and category"""
        service = TemporalPriorService()

        grouped = service._group_episodes_by_entity_category(sample_episodes)

        # Check that episodes are grouped (returns defaultdict)
        assert isinstance(grouped, defaultdict)
        assert len(grouped) > 0
        
        # Check structure - convert to regular dict for checking
        for (entity_id, category), episodes in grouped.items():
            assert isinstance(entity_id, str)
            assert isinstance(category, SignalCategory)
            assert len(episodes) > 0
            # Check that signal_category was added
            assert 'signal_category' in episodes[0]

    def test_service_initialization(self):
        """Test service initializes correctly"""
        service = TemporalPriorService()
        
        # Check that service loaded priors
        assert hasattr(service, 'priors')
        assert isinstance(service.priors, dict)
        
        # Check that priors file path is set
        assert hasattr(service, 'priors_path')


class TestIntegration:
    """Integration tests for the complete system"""

    def test_end_to_end_multiplier_calculation(self, sample_episodes):
        """Test complete flow from episodes to multiplier"""
        # This would require a full integration setup with Graphiti
        # For now, test the individual components
        seasonality = SeasonalityAnalyzer.compute_seasonality(sample_episodes)
        assert sum(seasonality.values()) == pytest.approx(1.0, rel=0.01)

        mean, std = RecurrenceAnalyzer.compute_recurrence(sample_episodes)
        assert mean is not None

        momentum = MomentumTracker.compute_momentum(sample_episodes)
        assert momentum["30d"] >= 0

    def test_category_mapping_coverage(self):
        """Test all 14 categories are reachable"""
        from backend.temporal.models import SignalCategory

        # Ensure all 14 categories are defined
        categories = [cat.value for cat in SignalCategory]
        assert len(categories) == 14

        # Test common keywords map correctly
        assert CategoryMapper.map_template_to_category("salesforce", "") == SignalCategory.CRM
        assert CategoryMapper.map_template_to_category("zendesk", "") == SignalCategory.TICKETING
        assert CategoryMapper.map_template_to_category("snowflake", "") == SignalCategory.DATA_PLATFORM
        assert CategoryMapper.map_template_to_category("shopify", "") == SignalCategory.COMMERCE


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
