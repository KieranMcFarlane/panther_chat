#!/usr/bin/env python3
"""
MVP Integration Tests for Temporal Sports Procurement Prediction Engine

Tests the complete signal classification and hypothesis state calculation flow.
"""

import pytest
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from schemas import RalphDecisionType, SignalClass, HypothesisState
from ralph_loop import classify_signal, recalculate_hypothesis_state


class TestSignalClassification:
    """Test signal classification function"""

    def test_classify_weak_accept(self):
        """WEAK_ACCEPT should classify as CAPABILITY"""
        result = classify_signal(RalphDecisionType.WEAK_ACCEPT, 0.5)
        assert result == SignalClass.CAPABILITY

    def test_classify_accept_low_confidence(self):
        """ACCEPT with <0.75 confidence should classify as PROCUREMENT_INDICATOR"""
        result = classify_signal(RalphDecisionType.ACCEPT, 0.65)
        assert result == SignalClass.PROCUREMENT_INDICATOR

    def test_classify_accept_high_confidence(self):
        """ACCEPT with >=0.75 confidence should classify as VALIDATED_RFP"""
        result = classify_signal(RalphDecisionType.ACCEPT, 0.80)
        assert result == SignalClass.VALIDATED_RFP

    def test_classify_accept_exact_threshold(self):
        """ACCEPT with exactly 0.75 confidence should classify as VALIDATED_RFP"""
        result = classify_signal(RalphDecisionType.ACCEPT, 0.75)
        assert result == SignalClass.VALIDATED_RFP

    def test_classify_tender_domain(self):
        """ACCEPT with tender domain should classify as VALIDATED_RFP"""
        result = classify_signal(
            RalphDecisionType.ACCEPT,
            0.60,
            source_domain="https://tenders.example.com"
        )
        assert result == SignalClass.VALIDATED_RFP

    def test_classify_procurement_domain(self):
        """ACCEPT with procurement domain should classify as VALIDATED_RFP"""
        result = classify_signal(
            RalphDecisionType.ACCEPT,
            0.60,
            source_domain="https://procurement.example.com"
        )
        assert result == SignalClass.VALIDATED_RFP

    def test_classify_rfp_domain(self):
        """ACCEPT with rfp. domain should classify as VALIDATED_RFP"""
        result = classify_signal(
            RalphDecisionType.ACCEPT,
            0.60,
            source_domain="https://rfp.example.com"
        )
        assert result == SignalClass.VALIDATED_RFP

    def test_classify_reject(self):
        """REJECT should return None (not classified)"""
        result = classify_signal(RalphDecisionType.REJECT, 0.5)
        assert result is None


class TestHypothesisStateRecalculation:
    """Test hypothesis state recalculation function"""

    def test_empty_signals(self):
        """No signals should result in MONITOR state with zero scores"""
        state = recalculate_hypothesis_state(
            entity_id="test-entity",
            category="CRM_UPGRADE",
            capability_signals=[],
            procurement_indicators=[],
            validated_rfps=[]
        )

        assert state.entity_id == "test-entity"
        assert state.category == "CRM_UPGRADE"
        assert state.maturity_score == 0.0
        assert state.activity_score == 0.0
        assert state.state == "MONITOR"

    def test_capability_signals_only(self):
        """CAPABILITY signals should increase maturity score"""
        state = recalculate_hypothesis_state(
            entity_id="test-entity",
            category="CRM_UPGRADE",
            capability_signals=[
                {"id": "1", "text": "Hiring CRM Manager"},
                {"id": "2", "text": "CRM evaluation"}
            ],
            procurement_indicators=[],
            validated_rfps=[]
        )

        assert state.maturity_score == 0.30  # 2 * 0.15
        assert state.activity_score == 0.0
        assert state.state == "MONITOR"  # maturity 0.30 < 0.5 threshold, activity 0.0 < 0.4

    def test_maturity_threshold_warm(self):
        """High maturity score should trigger WARM state"""
        state = recalculate_hypothesis_state(
            entity_id="test-entity",
            category="CRM_UPGRADE",
            capability_signals=[
                {"id": str(i), "text": f"Signal {i}"}
                for i in range(4)  # 4 * 0.15 = 0.60
            ],
            procurement_indicators=[],
            validated_rfps=[]
        )

        assert state.maturity_score == 0.60  # Capped at 1.0
        assert state.state == "WARM"  # maturity >= 0.5

    def test_procurement_indicators_only(self):
        """PROCUREMENT_INDICATOR signals should increase activity score"""
        state = recalculate_hypothesis_state(
            entity_id="test-entity",
            category="CRM_UPGRADE",
            capability_signals=[],
            procurement_indicators=[
                {"id": "1", "text": "Vendor evaluation"},
                {"id": "2", "text": "Budget planning"}
            ],
            validated_rfps=[]
        )

        assert state.maturity_score == 0.0
        assert state.activity_score == 0.50  # 2 * 0.25
        assert state.state == "WARM"  # activity >= 0.4

    def test_activity_threshold_engage(self):
        """High activity score should trigger ENGAGE state"""
        state = recalculate_hypothesis_state(
            entity_id="test-entity",
            category="CRM_UPGRADE",
            capability_signals=[],
            procurement_indicators=[
                {"id": str(i), "text": f"Indicator {i}"}
                for i in range(3)  # 3 * 0.25 = 0.75
            ],
            validated_rfps=[]
        )

        assert state.activity_score == 0.75
        assert state.state == "ENGAGE"  # activity >= 0.6

    def test_validated_rfp_triggers_live(self):
        """VALIDATED_RFP should trigger LIVE state"""
        state = recalculate_hypothesis_state(
            entity_id="test-entity",
            category="CRM_UPGRADE",
            capability_signals=[],
            procurement_indicators=[],
            validated_rfps=[
                {"id": "1", "text": "Official tender released"}
            ]
        )

        assert state.state == "LIVE"

    def test_score_capping(self):
        """Scores should be capped at 1.0"""
        state = recalculate_hypothesis_state(
            entity_id="test-entity",
            category="CRM_UPGRADE",
            capability_signals=[
                {"id": str(i), "text": f"Signal {i}"}
                for i in range(20)  # Would be 3.0, should cap to 1.0
            ],
            procurement_indicators=[],
            validated_rfps=[]
        )

        assert state.maturity_score == 1.0


class TestEndToEndClassification:
    """Test end-to-end classification flow"""

    def test_full_classification_flow(self):
        """Test complete flow from decision to hypothesis state"""
        # Step 1: Simulate raw signals
        raw_decisions = [
            (RalphDecisionType.WEAK_ACCEPT, 0.50, None, "Capability signal 1"),
            (RalphDecisionType.WEAK_ACCEPT, 0.45, None, "Capability signal 2"),
            (RalphDecisionType.ACCEPT, 0.65, None, "Indicator signal 1"),
            (RalphDecisionType.ACCEPT, 0.70, None, "Indicator signal 2"),
        ]

        # Step 2: Classify signals
        capability_signals = []
        procurement_indicators = []
        validated_rfps = []

        for decision, confidence, domain, text in raw_decisions:
            signal_class = classify_signal(decision, confidence, domain)
            signal_dict = {"text": text, "confidence": confidence}

            if signal_class == SignalClass.CAPABILITY:
                capability_signals.append(signal_dict)
            elif signal_class == SignalClass.PROCUREMENT_INDICATOR:
                procurement_indicators.append(signal_dict)
            elif signal_class == SignalClass.VALIDATED_RFP:
                validated_rfps.append(signal_dict)

        # Step 3: Verify classification
        assert len(capability_signals) == 2
        assert len(procurement_indicators) == 2
        assert len(validated_rfps) == 0

        # Step 4: Calculate hypothesis state
        state = recalculate_hypothesis_state(
            entity_id="arsenal-fc",
            category="CRM_UPGRADE",
            capability_signals=capability_signals,
            procurement_indicators=procurement_indicators,
            validated_rfps=validated_rfps
        )

        # Step 5: Verify final state
        assert state.entity_id == "arsenal-fc"
        assert state.category == "CRM_UPGRADE"
        assert state.maturity_score == 0.30  # 2 * 0.15
        assert state.activity_score == 0.50  # 2 * 0.25
        assert state.state == "WARM"  # activity >= 0.4

    def test_live_state_flow(self):
        """Test flow that results in LIVE state"""
        # Simulate signals leading to LIVE state
        capability_signals = [
            {"text": f"Capability {i}"} for i in range(3)
        ]
        procurement_indicators = [
            {"text": f"Indicator {i}"} for i in range(2)
        ]
        validated_rfps = [
            {"text": "Official RFP released"}
        ]

        state = recalculate_hypothesis_state(
            entity_id="test-entity",
            category="ANALYTICS",
            capability_signals=capability_signals,
            procurement_indicators=procurement_indicators,
            validated_rfps=validated_rfps
        )

        # LIVE state is triggered by validated_rfps >= 1
        assert state.state == "LIVE"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
