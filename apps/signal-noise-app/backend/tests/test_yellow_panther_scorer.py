"""
Unit tests for Yellow Panther Fit Scorer
"""

import pytest
from backend.yellow_panther_scorer import (
    YellowPantherFitScorer,
    score_yp_fit,
    ServiceCategory,
    PriorityTier,
    BudgetAlignment
)


class TestYellowPantherFitScorer:
    """Test suite for YP fit scoring"""

    @pytest.fixture
    def scorer(self):
        """Create scorer instance"""
        return YellowPantherFitScorer()

    @pytest.fixture
    def sample_signal_crm(self):
        """Sample CRM RFP signal"""
        return {
            "id": "test_signal_001",
            "entity_id": "arsenal",
            "signal_category": "CRM",
            "confidence": 0.85,
            "temporal_multiplier": 1.35,
            "evidence": [
                {
                    "content": "Arsenal FC hiring CRM Director - Salesforce experience required",
                    "source": "LinkedIn",
                    "credibility": 0.8
                },
                {
                    "content": "Legacy CRM system from 2015 needs replacement",
                    "source": "Job Posting",
                    "credibility": 0.75
                },
                {
                    "content": "Digital transformation program includes CRM modernization",
                    "source": "Press Release",
                    "credibility": 0.9
                }
            ]
        }

    @pytest.fixture
    def sample_signal_mobile_app(self):
        """Sample mobile app RFP signal (perfect YP fit)"""
        return {
            "id": "test_signal_002",
            "entity_id": "tottenham",
            "signal_category": "MOBILE_APPS",
            "confidence": 0.90,
            "temporal_multiplier": 1.40,
            "evidence": [
                {
                    "content": "Tottenham Hotspur seeking official mobile app development partner",
                    "source": "Tender Notice",
                    "credibility": 0.95
                },
                {
                    "content": "Fan engagement mobile platform for iOS and Android",
                    "source": "RFP Document",
                    "credibility": 0.9
                },
                {
                    "content": "Strategic initiative to enhance fan experience through mobile",
                    "source": "Executive Announcement",
                    "credibility": 0.85
                },
                {
                    "content": "Budget: £200K-£300K for 6-month project",
                    "source": "Budget Document",
                    "credibility": 0.88
                }
            ]
        }

    @pytest.fixture
    def sample_entity_context_arsenal(self):
        """Sample entity context for Arsenal"""
        return {
            "name": "Arsenal FC",
            "type": "club",
            "country": "UK",
            "league": "Premier League",
            "size": "elite_high"
        }

    @pytest.fixture
    def sample_entity_context_tottenham(self):
        """Sample entity context for Tottenham"""
        return {
            "name": "Tottenham Hotspur",
            "type": "club",
            "country": "UK",
            "league": "Premier League",
            "size": "elite_mid"
        }

    def test_service_match_mobile_apps_high_score(self, scorer):
        """Test that mobile app RFPs score high on service match"""
        signal = {
            "signal_category": "MOBILE_APPS",
            "evidence": [
                {"content": "Looking for mobile app development partner for official club app"},
                {"content": "iOS and Android native applications required"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should have high service match score
        assert score['scores']['service_match'] >= 30
        assert 'MOBILE_APPS' in score['service_alignment']

    def test_service_match_fan_engagement(self, scorer):
        """Test that fan engagement RFPs score appropriately"""
        signal = {
            "signal_category": "FAN_ENGAGEMENT",
            "evidence": [
                {"content": "Fan engagement platform needed for season ticket holders"},
                {"content": "Supporter experience enhancement initiative"}
            ]
        }

        score = scorer.score_opportunity(signal)

        assert score['scores']['service_match'] >= 20
        assert 'FAN_ENGAGEMENT' in score['service_alignment']

    def test_budget_alignment_perfect(self, scorer):
        """Test perfect budget alignment detection"""
        signal = {
            "signal_category": "MOBILE_APPS",
            "evidence": [
                {"content": "Strategic mobile platform initiative"},
                {"content": "Enterprise-level official application"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should have good budget score
        assert score['scores']['budget'] >= 18
        assert score['budget_alignment'] in [BudgetAlignment.GOOD, BudgetAlignment.PERFECT]

    def test_budget_alignment_poor(self, scorer):
        """Test poor budget alignment detection"""
        signal = {
            "signal_category": "MOBILE_APPS",
            "evidence": [
                {"content": "Small startup mobile project"},
                {"content": "Budget-friendly micro app"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should have low budget score
        assert score['scores']['budget'] <= 10
        assert score['budget_alignment'] == BudgetAlignment.POOR

    def test_timeline_fit_ideal(self, scorer):
        """Test ideal timeline (3-12 months) scoring"""
        signal = {
            "signal_category": "CRM",
            "evidence": [
                {"content": "6-month CRM implementation project"},
                {"content": "Quarter-based rollout plan"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should have high timeline score
        assert score['scores']['timeline'] >= 12

    def test_entity_size_ideal(self, scorer, sample_entity_context_tottenham):
        """Test that ideal entity size (Tottenham) scores high"""
        signal = {
            "signal_category": "MOBILE_APPS",
            "evidence": []
        }

        score = scorer.score_opportunity(signal, sample_entity_context_tottenham)

        # Should have high entity size score
        assert score['scores']['entity_size'] >= 8

    def test_entity_size_too_big(self, scorer):
        """Test that very large entities score lower"""
        signal = {
            "signal_category": "MOBILE_APPS",
            "evidence": []
        }

        entity_context = {
            "name": "Manchester United",
            "type": "club",
            "country": "UK"
        }

        score = scorer.score_opportunity(signal, entity_context)

        # Should have lower entity size score
        assert score['scores']['entity_size'] <= 5

    def test_geographic_fit_uk(self, scorer, sample_entity_context_arsenal):
        """Test that UK entities score high"""
        signal = {
            "signal_category": "CRM",
            "evidence": []
        }

        score = scorer.score_opportunity(signal, sample_entity_context_arsenal)

        # Should have perfect geographic score
        assert score['scores']['geographic'] == 10.0

    def test_geographic_fit_europe(self, scorer):
        """Test that European entities score high"""
        signal = {
            "signal_category": "CRM",
            "evidence": []
        }

        entity_context = {
            "name": "Paris Saint-Germain",
            "type": "club",
            "country": "France"
        }

        score = scorer.score_opportunity(signal, entity_context)

        # Should have perfect geographic score
        assert score['scores']['geographic'] == 10.0

    def test_priority_tier_1(self, scorer, sample_signal_mobile_app, sample_entity_context_tottenham):
        """Test TIER_1 priority for perfect fit"""
        score = scorer.score_opportunity(
            sample_signal_mobile_app,
            sample_entity_context_tottenham
        )

        # Should be TIER_1
        assert score['priority'] == PriorityTier.TIER_1
        assert score['fit_score'] >= 90

    def test_priority_tier_2(self, scorer, sample_signal_crm, sample_entity_context_arsenal):
        """Test TIER_2 priority for good fit"""
        score = scorer.score_opportunity(
            sample_signal_crm,
            sample_entity_context_arsenal
        )

        # Should be TIER_2 or TIER_1
        assert score['priority'] in [PriorityTier.TIER_1, PriorityTier.TIER_2]

    def test_priority_tier_3(self, scorer):
        """Test TIER_3 priority for medium fit"""
        signal = {
            "signal_category": "ANALYTICS",
            "confidence": 0.75,
            "temporal_multiplier": 1.0,
            "evidence": [
                {"content": "Looking for analytics solution"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should be TIER_3 or TIER_2
        assert score['priority'] in [PriorityTier.TIER_2, PriorityTier.TIER_3]

    def test_yp_advantages_mobile_apps(self, scorer):
        """Test that mobile apps generate YP advantages"""
        signal = {
            "signal_category": "MOBILE_APPS",
            "evidence": [
                {"content": "Official mobile app development"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should have mobile-related advantages
        assert len(score['yp_advantages']) > 0
        assert any('mobile' in adv.lower() for adv in score['yp_advantages'])

    def test_yp_advantages_fan_engagement(self, scorer):
        """Test that fan engagement generates YP advantages"""
        signal = {
            "signal_category": "FAN_ENGAGEMENT",
            "evidence": [
                {"content": "Fan engagement platform needed"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should have fan engagement advantages
        assert len(score['yp_advantages']) > 0
        assert any('fan' in adv.lower() or 'federation' in adv.lower()
                   for adv in score['yp_advantages'])

    def test_recommended_actions_high_fit(self, scorer, sample_signal_mobile_app):
        """Test that high-fit opportunities get urgent recommendations"""
        score = scorer.score_opportunity(sample_signal_mobile_app)

        # Should recommend immediate action
        assert any('immediate' in action.lower() for action in score['recommended_actions'])

    def test_recommended_actions_medium_fit(self, scorer):
        """Test that medium-fit opportunities get moderate recommendations"""
        signal = {
            "signal_category": "ANALYTICS",
            "confidence": 0.75,
            "evidence": [
                {"content": "Looking for analytics platform"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should recommend monitoring
        assert any('monitor' in action.lower() or 'research' in action.lower()
                   for action in score['recommended_actions'])

    def test_convenience_function(self):
        """Test the convenience function"""
        signal = {
            "signal_category": "CRM",
            "confidence": 0.8,
            "evidence": [
                {"content": "CRM system needed"}
            ]
        }

        score = score_yp_fit(signal)

        # Should return same structure
        assert 'fit_score' in score
        assert 'priority' in score
        assert 'service_alignment' in score

    def test_service_match_multiple_services(self, scorer):
        """Test detection of multiple matching services"""
        signal = {
            "signal_category": "MOBILE_APPS",
            "evidence": [
                {"content": "Official mobile app with fan engagement features"},
                {"content": "Fan platform for iOS and Android"}
            ]
        }

        score = scorer.score_opportunity(signal)

        # Should detect multiple services
        assert len(score['service_alignment']) >= 2
        assert 'MOBILE_APPS' in score['service_alignment']
        assert 'FAN_ENGAGEMENT' in score['service_alignment']

    def test_total_fit_score_range(self, scorer, sample_signal_crm):
        """Test that total fit score is in expected range"""
        score = scorer.score_opportunity(sample_signal_crm)

        # Total score should be between 0 and 100
        assert 0 <= score['fit_score'] <= 100

    def test_scores_sum_to_total(self, scorer, sample_signal_crm):
        """Test that individual scores sum to total"""
        score = scorer.score_opportunity(sample_signal_crm)

        # Sum of individual scores should equal total
        expected_total = sum(score['scores'].values())
        assert abs(score['fit_score'] - expected_total) < 0.1  # Allow small rounding diff


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
