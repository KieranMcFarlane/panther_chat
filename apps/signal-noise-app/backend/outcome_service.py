#!/usr/bin/env python3
"""
Outcome tracking service - Closes the feedback loop.

This service tracks RFP outcomes and updates entity intelligence scores
based on actual results. Won RFPs increase scores, lost RFPs decrease them.

Part of: Close the Loop - Temporal Intelligence for RFP Detection

Usage:
    from backend.outcome_service import OutcomeService

    service = OutcomeService()

    # Record a WON outcome
    await service.record_outcome(
        rfp_id="arsenal-digital-001",
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        status="won",
        value_actual=125000
    )

    # Get performance summary
    summary = await service.get_entity_summary("arsenal-fc")
"""

import os
import sys
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Try to import Supabase client
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logging.warning("⚠️  Supabase client not available")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RFPStatus(str, Enum):
    """RFP status values matching database constraint"""
    DETECTED = "detected"
    ANALYZING = "analyzing"
    CONTACTED = "contacted"
    QUOTING = "quoting"
    SUBMITTED = "submitted"
    SHORTLISTED = "shortlisted"
    WON = "won"
    LOST = "lost"
    WITHDREW = "withdrew"
    ON_HOLD = "on_hold"


@dataclass
class OutcomeRecord:
    """Outcome record data structure"""
    rfp_id: str
    entity_id: str
    entity_name: str
    status: RFPStatus
    stage: Optional[str] = None
    probability: Optional[int] = None
    value_estimated: Optional[float] = None
    value_actual: Optional[float] = None
    currency: str = "USD"
    outcome_date: Optional[str] = None
    outcome_notes: Optional[str] = None
    competitor: Optional[str] = None
    loss_reason: Optional[str] = None
    lessons_learned: Optional[str] = None
    tags: Optional[List[str]] = None
    created_by: Optional[str] = None


@dataclass
class EntityPerformanceSummary:
    """Aggregated performance metrics for an entity"""
    entity_id: str
    entity_name: str
    total_opportunities: int
    wins: int
    losses: int
    completed: int
    win_rate_percent: float
    total_won_value: float
    pipeline_value: float
    last_win_date: Optional[str]


class OutcomeService:
    """
    Service for tracking RFP outcomes and closing the feedback loop

    Updates entity intelligence scores based on outcomes:
    - Won RFPs: +10 to intelligence score
    - Lost RFPs: -5 to intelligence score
    - Creates temporal episodes for tracking
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None
    ):
        """
        Initialize the outcome service

        Args:
            supabase_url: Supabase project URL
            supabase_key: Supabase service key (for writes)
        """
        self.supabase_url = supabase_url or os.getenv(
            "NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL"
        )
        self.supabase_key = supabase_key or os.getenv(
            "SUPABASE_SERVICE_ROLE_KEY"
        ) or os.getenv("SUPABASE_ANON_KEY")

        self.client = None
        if SUPABASE_AVAILABLE and self.supabase_url and self.supabase_key:
            self.client = create_client(self.supabase_url, self.supabase_key)
            logger.info("✅ OutcomeService initialized with Supabase")
        else:
            logger.warning("⚠️  OutcomeService initialized without Supabase (read-only)")

    async def record_outcome(
        self,
        rfp_id: str,
        entity_id: str,
        entity_name: str,
        status: RFPStatus,
        stage: Optional[str] = None,
        probability: Optional[int] = None,
        value_estimated: Optional[float] = None,
        value_actual: Optional[float] = None,
        currency: str = "USD",
        outcome_date: Optional[str] = None,
        outcome_notes: Optional[str] = None,
        competitor: Optional[str] = None,
        loss_reason: Optional[str] = None,
        lessons_learned: Optional[str] = None,
        tags: Optional[List[str]] = None,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Record an RFP outcome and trigger feedback loop updates

        Args:
            rfp_id: Unique RFP identifier
            entity_id: Entity identifier (neo4j_id or slug)
            entity_name: Entity display name
            status: Current status of the RFP
            stage: Current stage in the process
            probability: Win probability (0-100)
            value_estimated: Estimated RFP value
            value_actual: Actual value (when known)
            currency: Currency code
            outcome_date: When the outcome was determined
            outcome_notes: Free text notes
            competitor: Who we lost to (if applicable)
            loss_reason: Why we lost
            lessons_learned: Feedback for continuous improvement
            tags: Categorization tags
            created_by: User recording the outcome

        Returns:
            Result dict with success status and data
        """
        if not self.client:
            return {
                "success": False,
                "error": "Supabase client not available",
                "rfp_id": rfp_id
            }

        try:
            # Prepare data
            data = {
                "rfp_id": rfp_id,
                "entity_id": entity_id,
                "entity_name": entity_name,
                "status": status.value if isinstance(status, RFPStatus) else status,
                "outcome_date": outcome_date or datetime.utcnow().isoformat(),
            }

            # Optional fields
            if stage is not None:
                data["stage"] = stage
            if probability is not None:
                data["probability"] = probability
            if value_estimated is not None:
                data["value_estimated"] = value_estimated
            if value_actual is not None:
                data["value_actual"] = value_actual
            if currency:
                data["currency"] = currency
            if outcome_notes:
                data["outcome_notes"] = outcome_notes
            if competitor:
                data["competitor"] = competitor
            if loss_reason:
                data["loss_reason"] = loss_reason
            if lessons_learned:
                data["lessons_learned"] = lessons_learned
            if tags:
                data["tags"] = tags
            if created_by:
                data["created_by"] = created_by

            # Upsert to handle both new and existing records
            result = self.client.table('rfp_outcomes').upsert(
                data,
                on_conflict='rfp_id'
            ).execute()

            # Trigger will automatically:
            # 1. Update entity intelligence score
            # 2. Create temporal episode
            # 3. Update outcome summary view

            outcome_id = result.data[0].get('id') if result.data else None

            logger.info(
                f"✅ Outcome recorded: {rfp_id} = {status} "
                f"(feedback loop triggered)"
            )

            # NEW: Trigger binding feedback processor
            try:
                from backend.binding_feedback_processor import BindingFeedbackProcessor

                feedback_processor = BindingFeedbackProcessor()

                # Determine outcome type for feedback
                outcome_type = status.value if isinstance(status, RFPStatus) else status

                # Only process terminal outcomes
                if outcome_type in ["won", "lost"]:
                    feedback_result = await feedback_processor.process_outcome_feedback(
                        rfp_id=rfp_id,
                        entity_id=entity_id,
                        outcome=outcome_type,
                        value_actual=value_actual,
                        metadata={
                            "outcome_id": outcome_id,
                            "stage": stage,
                            "probability": probability,
                            "competitor": competitor,
                            "loss_reason": loss_reason
                        }
                    )

                    if feedback_result.success:
                        logger.info(
                            f"🔄 Binding updated: {entity_id} "
                            f"(confidence: {feedback_result.new_confidence:.2f})"
                        )

            except ImportError:
                logger.warning("⚠️  BindingFeedbackProcessor not available, skipping binding update")
            except Exception as e:
                logger.error(f"⚠️  Failed to update binding: {e}")

            return {
                "success": True,
                "outcome_id": outcome_id,
                "rfp_id": rfp_id,
                "entity_id": entity_id,
                "status": status,
                "message": "Outcome recorded and intelligence scores updated"
            }

        except Exception as e:
            logger.error(f"❌ Failed to record outcome: {e}")
            return {
                "success": False,
                "error": str(e),
                "rfp_id": rfp_id
            }

    async def get_outcome(
        self,
        rfp_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get outcome record for an RFP

        Args:
            rfp_id: RFP identifier

        Returns:
            Outcome record or None
        """
        if not self.client:
            return None

        try:
            result = self.client.table('rfp_outcomes')\
                .select('*')\
                .eq('rfp_id', rfp_id)\
                .single()\
                .execute()
            return result.data
        except Exception as e:
            logger.error(f"Failed to get outcome: {e}")
            return None

    async def get_entity_outcomes(
        self,
        entity_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get all outcomes for an entity

        Args:
            entity_id: Entity identifier
            limit: Maximum records to return

        Returns:
            List of outcome records
        """
        if not self.client:
            return []

        try:
            result = self.client.table('rfp_outcomes')\
                .select('*')\
                .eq('entity_id', entity_id)\
                .order('outcome_date', desc=True)\
                .limit(limit)\
                .execute()
            return result.data
        except Exception as e:
            logger.error(f"Failed to get entity outcomes: {e}")
            return []

    async def get_entity_summary(
        self,
        entity_id: str
    ) -> Optional[EntityPerformanceSummary]:
        """
        Get performance summary for an entity

        Args:
            entity_id: Entity identifier

        Returns:
            Entity performance summary
        """
        if not self.client:
            return None

        try:
            # Query the summary view
            result = self.client.table('rfp_outcome_summary')\
                .select('*')\
                .eq('entity_id', entity_id)\
                .single()\
                .execute()

            if result.data:
                return EntityPerformanceSummary(**result.data)
            return None

        except Exception as e:
            logger.error(f"Failed to get entity summary: {e}")
            return None

    async def update_status(
        self,
        rfp_id: str,
        status: RFPStatus,
        stage: Optional[str] = None,
        probability: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Update the status of an in-flight RFP

        Args:
            rfp_id: RFP identifier
            status: New status
            stage: Current stage
            probability: Win probability

        Returns:
            Update result
        """
        if not self.client:
            return {"success": False, "error": "Supabase client not available"}

        try:
            update_data = {"status": status.value}
            if stage is not None:
                update_data["stage"] = stage
            if probability is not None:
                update_data["probability"] = probability

            result = self.client.table('rfp_outcomes')\
                .update(update_data)\
                .eq('rfp_id', rfp_id)\
                .execute()

            logger.info(f"✅ Status updated: {rfp_id} → {status}")

            return {
                "success": True,
                "rfp_id": rfp_id,
                "status": status
            }

        except Exception as e:
            logger.error(f"Failed to update status: {e}")
            return {
                "success": False,
                "error": str(e),
                "rfp_id": rfp_id
            }

    async def get_leaderboard(
        self,
        by: str = "wins",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get entity performance leaderboard

        Args:
            by: Sort metric ('wins', 'win_rate', 'total_value')
            limit: Number of results

        Returns:
            Sorted list of entity performance
        """
        if not self.client:
            return []

        try:
            column = {
                'wins': 'wins',
                'win_rate': 'win_rate_percent',
                'total_value': 'total_won_value'
            }.get(by, 'wins')

            result = self.client.table('rfp_outcome_summary')\
                .select('*')\
                .order(column, desc=True)\
                .limit(limit)\
                .execute()

            return result.data

        except Exception as e:
            logger.error(f"Failed to get leaderboard: {e}")
            return []

    async def get_loss_reasons(
        self,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get common loss reasons for analysis

        Args:
            limit: Maximum results

        Returns:
            List of lost opportunities with reasons
        """
        if not self.client:
            return []

        try:
            result = self.client.table('rfp_outcomes')\
                .select('entity_name, loss_reason, competitor, value_estimated, outcome_date')\
                .eq('status', 'lost')\
                .not_.is_('loss_reason', 'null')\
                .order('outcome_date', desc=True)\
                .limit(limit)\
                .execute()

            return result.data

        except Exception as e:
            logger.error(f"Failed to get loss reasons: {e}")
            return []


# =============================================================================
# Convenience Functions
# =============================================================================

async def record_win(
    rfp_id: str,
    entity_id: str,
    entity_name: str,
    value_actual: float,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to record a WON outcome

    Args:
        rfp_id: RFP identifier
        entity_id: Entity identifier
        entity_name: Entity name
        value_actual: Actual value of won RFP
        notes: Optional notes

    Returns:
        Result dict
    """
    service = OutcomeService()
    return await service.record_outcome(
        rfp_id=rfp_id,
        entity_id=entity_id,
        entity_name=entity_name,
        status=RFPStatus.WON,
        value_actual=value_actual,
        outcome_notes=notes
    )


async def record_loss(
    rfp_id: str,
    entity_id: str,
    entity_name: str,
    loss_reason: str,
    competitor: Optional[str] = None,
    value_estimated: Optional[float] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to record a LOST outcome

    Args:
        rfp_id: RFP identifier
        entity_id: Entity identifier
        entity_name: Entity name
        loss_reason: Why we lost
        competitor: Who won
        value_estimated: Estimated value
        notes: Optional notes

    Returns:
        Result dict
    """
    service = OutcomeService()
    return await service.record_outcome(
        rfp_id=rfp_id,
        entity_id=entity_id,
        entity_name=entity_name,
        status=RFPStatus.LOST,
        loss_reason=loss_reason,
        competitor=competitor,
        value_estimated=value_estimated,
        outcome_notes=notes
    )


if __name__ == "__main__":
    # Test the outcome service
    import asyncio

    async def test():
        service = OutcomeService()

        print("Testing OutcomeService...")

        # Test recording a win
        win_result = await service.record_outcome(
            rfp_id="test-arsenal-win-001",
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            status=RFPStatus.WON,
            value_actual=125000,
            outcome_notes="Successfully delivered digital transformation project"
        )
        print(f"Win result: {win_result}")

        # Test recording a loss
        loss_result = await service.record_outcome(
            rfp_id="test-chelsea-loss-001",
            entity_id="chelsea-fc",
            entity_name="Chelsea FC",
            status=RFPStatus.LOST,
            loss_reason="Price",
            competitor="Competitor X",
            value_estimated=80000,
            outcome_notes="Client chose lower-cost alternative"
        )
        print(f"Loss result: {loss_result}")

        # Get entity summary
        summary = await service.get_entity_summary("arsenal-fc")
        if summary:
            print(f"\nArsenal FC Summary:")
            print(f"  Total Opportunities: {summary.total_opportunities}")
            print(f"  Wins: {summary.wins}")
            print(f"  Win Rate: {summary.win_rate_percent}%")
            print(f"  Total Won Value: ${summary.total_won_value:,.2f}")

    asyncio.run(test())
