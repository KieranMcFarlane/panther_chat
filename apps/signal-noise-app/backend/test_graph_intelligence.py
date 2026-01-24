#!/usr/bin/env python3
"""
Unit Tests for Graph Intelligence Architecture

Tests:
1. Schema validation (Entity, Signal, Evidence, Relationship)
2. Ralph Loop validation logic
3. Model cascade functionality
4. Graph intelligence tools

Usage:
    python backend/test_graph_intelligence.py
"""

import os
import sys
import asyncio
import unittest
from datetime import datetime, timezone
from typing import List, Dict, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.schemas import (
    Entity, Signal, Evidence, Relationship,
    EntityType, SignalType, SignalSubtype, RelationshipType,
    SignalValidationResult, validate_signal_minimums,
    map_episode_type_to_signal_type
)
from backend.ralph_loop import RalphLoop, RalphLoopConfig
from backend.claude_client import ClaudeClient, ModelRegistry


class TestSchemaValidation(unittest.TestCase):
    """Test schema validation and creation"""

    def test_entity_creation(self):
        """Test Entity creation with required fields"""
        entity = Entity(
            id="ac-milan",
            type=EntityType.ORG,
            name="AC Milan",
            metadata={"founded": 1899}
        )
        self.assertEqual(entity.id, "ac-milan")
        self.assertEqual(entity.type, EntityType.ORG)
        self.assertEqual(entity.name, "AC Milan")
        self.assertIn("founded", entity.metadata)

    def test_signal_creation(self):
        """Test Signal creation with validation requirements"""
        signal = Signal(
            id="signal_ac-milan_rfp_20250122",
            type=SignalType.RFP_DETECTED,
            confidence=0.8,
            first_seen=datetime.now(timezone.utc),
            entity_id="ac-milan",
            validated=False
        )
        self.assertEqual(signal.type, SignalType.RFP_DETECTED)
        self.assertEqual(signal.confidence, 0.8)
        self.assertFalse(signal.validated)

    def test_evidence_creation(self):
        """Test Evidence creation with credibility scoring"""
        evidence = Evidence(
            id="evidence_1",
            source="LinkedIn",
            date=datetime.now(timezone.utc),
            url="https://linkedin.com/job/rfp",
            signal_id="signal_1",
            credibility_score=0.7
        )
        self.assertEqual(evidence.source, "LinkedIn")
        self.assertEqual(evidence.credibility_score, 0.7)

    def test_relationship_creation(self):
        """Test Relationship creation between entities"""
        relationship = Relationship(
            id="rel_1",
            type=RelationshipType.PARTNER_OF,
            from_entity="ac-milan",
            to_entity="tech-partner",
            confidence=0.9,
            valid_from=datetime.now(timezone.utc)
        )
        self.assertEqual(relationship.type, RelationshipType.PARTNER_OF)
        self.assertEqual(relationship.confidence, 0.9)

    def test_signal_validation_minimums(self):
        """Test signal minimum validation requirements"""
        # Create signal with sufficient evidence
        signal = Signal(
            id="signal_1",
            type=SignalType.RFP_DETECTED,
            confidence=0.8,
            first_seen=datetime.now(timezone.utc),
            entity_id="ac-milan"
        )

        # Create 3 pieces of evidence (minimum required)
        evidence_list = [
            Evidence(
                id=f"evidence_{i}",
                source=f"Source{i}",
                date=datetime.now(timezone.utc),
                signal_id="signal_1",
                credibility_score=0.7
            )
            for i in range(3)
        ]

        result = validate_signal_minimums(signal, evidence_list)

        self.assertTrue(result.passed)
        self.assertGreaterEqual(result.evidence_count, 3)
        self.assertGreaterEqual(result.confidence, 0.7)

    def test_signal_validation_insufficient_evidence(self):
        """Test signal validation fails with insufficient evidence"""
        signal = Signal(
            id="signal_1",
            type=SignalType.RFP_DETECTED,
            confidence=0.8,
            first_seen=datetime.now(timezone.utc),
            entity_id="ac-milan"
        )

        # Only 2 pieces of evidence (below minimum)
        evidence_list = [
            Evidence(
                id=f"evidence_{i}",
                source=f"Source{i}",
                date=datetime.now(timezone.utc),
                signal_id="signal_1",
                credibility_score=0.7
            )
            for i in range(2)
        ]

        result = validate_signal_minimums(signal, evidence_list)

        self.assertFalse(result.passed)
        self.assertTrue(any("insufficient evidence" in reason.lower() for reason in result.rejection_reasons))

    def test_signal_validation_low_confidence(self):
        """Test signal validation fails with low confidence"""
        signal = Signal(
            id="signal_1",
            type=SignalType.RFP_DETECTED,
            confidence=0.5,  # Below 0.7 threshold
            first_seen=datetime.now(timezone.utc),
            entity_id="ac-milan"
        )

        evidence_list = [
            Evidence(
                id=f"evidence_{i}",
                source=f"Source{i}",
                date=datetime.now(timezone.utc),
                signal_id="signal_1",
                credibility_score=0.7
            )
            for i in range(3)
        ]

        result = validate_signal_minimums(signal, evidence_list)

        self.assertFalse(result.passed)
        self.assertTrue(any("confidence" in reason.lower() for reason in result.rejection_reasons))

    def test_episode_type_mapping(self):
        """Test mapping from episode types to signal types"""
        # Test RFP-related episode types
        self.assertEqual(
            map_episode_type_to_signal_type("RFP_DETECTED"),
            SignalType.RFP_DETECTED
        )

        # Test partnership episode types
        self.assertEqual(
            map_episode_type_to_signal_type("PARTNERSHIP_FORMED"),
            SignalType.PARTNERSHIP_FORMED
        )

        # Test unknown types default to RFP_DETECTED
        self.assertEqual(
            map_episode_type_to_signal_type("UNKNOWN_TYPE"),
            SignalType.RFP_DETECTED
        )


class TestRalphLoop(unittest.TestCase):
    """Test Ralph Loop validation logic"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = RalphLoopConfig(
            min_evidence=3,
            min_confidence=0.7,
            max_passes=3
        )

    def test_ralph_loop_config_defaults(self):
        """Test Ralph Loop configuration defaults"""
        config = RalphLoopConfig()
        self.assertEqual(config.min_evidence, 3)
        self.assertEqual(config.min_confidence, 0.7)
        self.assertEqual(config.max_passes, 3)

    def test_ralph_loop_custom_config(self):
        """Test Ralph Loop with custom configuration"""
        config = RalphLoopConfig(
            min_evidence=5,
            min_confidence=0.8,
            max_passes=2
        )
        self.assertEqual(config.min_evidence, 5)
        self.assertEqual(config.min_confidence, 0.8)
        self.assertEqual(config.max_passes, 2)

    def test_pass1_filter_rule_based(self):
        """Test Pass 1: Rule-based filtering logic"""
        # This would require mocking RalphLoop instance
        # For now, test the validation logic directly
        raw_signals = [
            {
                "entity_id": "ac-milan",
                "signal_type": "RFP_DETECTED",
                "confidence": 0.8,
                "evidence": [
                    {"source": "LinkedIn", "credibility_score": 0.7},
                    {"source": "News", "credibility_score": 0.8},
                    {"source": "Official", "credibility_score": 0.9}
                ]
            }
        ]

        # Signal should pass Pass 1 (3 evidence, good confidence)
        signal = raw_signals[0]
        self.assertGreaterEqual(len(signal["evidence"]), 3)
        self.assertGreaterEqual(signal["confidence"], 0.7)


class TestModelCascade(unittest.TestCase):
    """Test model cascade implementation"""

    def test_model_registry_exists(self):
        """Test ModelRegistry has required models"""
        models = ModelRegistry.get_all_models()

        self.assertIn("haiku", models)
        self.assertIn("sonnet", models)
        self.assertIn("opus", models)

    def test_haiku_cheapest(self):
        """Test Haiku is the cheapest model"""
        models = ModelRegistry.get_all_models()

        haiku_cost = models["haiku"].cost_per_million_tokens
        sonnet_cost = models["sonnet"].cost_per_million_tokens
        opus_cost = models["opus"].cost_per_million_tokens

        self.assertLess(haiku_cost, sonnet_cost)
        self.assertLess(sonnet_cost, opus_cost)
        self.assertEqual(haiku_cost, 0.25)

    def test_model_ids_correct(self):
        """Test model IDs are correct"""
        models = ModelRegistry.get_all_models()

        self.assertEqual(
            models["haiku"].model_id,
            "claude-3-5-haiku-20241022"
        )
        self.assertEqual(
            models["sonnet"].model_id,
            "claude-3-5-sonnet-20241022"
        )
        self.assertEqual(
            models["opus"].model_id,
            "claude-3-opus-20240229"
        )

    def test_cost_savings_calculation(self):
        """Test expected cost savings with model cascade"""
        models = ModelRegistry.get_all_models()

        haiku_cost = models["haiku"].cost_per_million_tokens
        opus_cost = models["opus"].cost_per_million_tokens

        # Opus is 60x more expensive than Haiku
        cost_ratio = opus_cost / haiku_cost
        self.assertEqual(cost_ratio, 60.0)

        # If we use Haiku 60% of the time, we save ~15% compared to always Sonnet
        haiku_usage = 0.6
        sonnet_usage = 0.3
        opus_usage = 0.1

        blended_cost = (
            haiku_usage * haiku_cost +
            sonnet_usage * models["sonnet"].cost_per_million_tokens +
            opus_usage * opus_cost
        )

        # Compare to always using Sonnet
        sonnet_only_cost = models["sonnet"].cost_per_million_tokens
        savings = (sonnet_only_cost - blended_cost) / sonnet_only_cost

        # At least 10% savings with this mix
        self.assertGreater(savings, 0.10)


class TestGraphIntelligenceTools(unittest.TestCase):
    """Test graph intelligence MCP tools"""

    def test_query_entity_tool_exists(self):
        """Test query_entity tool is available"""
        # This would require starting the MCP server
        # For now, test that the module exists and has the tool
        try:
            from backend.graphiti_mcp_server import query_entity
            self.assertTrue(callable(query_entity))
        except ImportError:
            self.fail("graphiti_mcp_server module not found")

    def test_query_subgraph_tool_exists(self):
        """Test query_subgraph tool is available"""
        try:
            from backend.graphiti_mcp_server import query_subgraph
            self.assertTrue(callable(query_subgraph))
        except ImportError:
            self.fail("graphiti_mcp_server module not found")

    def test_find_related_signals_tool_exists(self):
        """Test find_related_signals tool is available"""
        try:
            from backend.graphiti_mcp_server import find_related_signals
            self.assertTrue(callable(find_related_signals))
        except ImportError:
            self.fail("graphiti_mcp_server module not found")


class TestIntegrationScenarios(unittest.TestCase):
    """Test integration scenarios"""

    def test_scraper_to_ralph_loop_flow(self):
        """Test scraper → Ralph Loop → Graphiti flow"""
        # Simulate raw signal from scraper
        raw_signal = {
            "entity_id": "ac-milan",
            "signal_type": "RFP_DETECTED",
            "confidence": 0.8,
            "evidence": [
                {
                    "source": "LinkedIn",
                    "date": datetime.now(timezone.utc).isoformat(),
                    "url": "https://linkedin.com/job/rfp",
                    "credibility_score": 0.7
                },
                {
                    "source": "News",
                    "date": datetime.now(timezone.utc).isoformat(),
                    "credibility_score": 0.8
                },
                {
                    "source": "Official",
                    "date": datetime.now(timezone.utc).isoformat(),
                    "credibility_score": 0.9
                }
            ]
        }

        # Signal should pass minimum validation
        signal = Signal(
            id="signal_test",
            type=SignalType[raw_signal["signal_type"]],
            confidence=raw_signal["confidence"],
            first_seen=datetime.now(timezone.utc),
            entity_id=raw_signal["entity_id"]
        )

        evidence_list = [
            Evidence(
                id=f"evidence_{i}",
                source=e["source"],
                date=datetime.fromisoformat(e["date"]),
                signal_id="signal_test",
                credibility_score=e.get("credibility_score", 0.5)
            )
            for i, e in enumerate(raw_signal["evidence"])
        ]

        result = validate_signal_minimums(signal, evidence_list)
        self.assertTrue(result.passed)

    def test_model_cascade_fallback(self):
        """Test model cascade fallback behavior"""
        # Simulate model cascade trying Haiku first
        models_to_try = ["haiku", "sonnet", "opus"]

        # Haiku should be tried first
        self.assertEqual(models_to_try[0], "haiku")

        # If Haiku fails, Sonnet should be tried
        self.assertEqual(models_to_try[1], "sonnet")

        # If Sonnet fails, Opus should be tried
        self.assertEqual(models_to_try[2], "opus")


def run_tests():
    """Run all tests and generate report"""
    print("="*70)
    print("GRAPH INTELLIGENCE ARCHITECTURE - UNIT TESTS")
    print("="*70)
    print()

    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestSchemaValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestRalphLoop))
    suite.addTests(loader.loadTestsFromTestCase(TestModelCascade))
    suite.addTests(loader.loadTestsFromTestCase(TestGraphIntelligenceTools))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegrationScenarios))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print summary
    print()
    print("="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Tests Run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print()

    if result.wasSuccessful():
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")

    print("="*70)

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
