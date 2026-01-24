"""
MVP End-to-End Integration Pipeline

Connects all components for thin vertical slice:
Entity Scheduler → Signal Extractor → Graph Memory → Query
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from dataclasses import dataclass

from scheduler.entity_scheduler import EntityScheduler
from signals.signal_extractor import SignalExtractor, ExtractedSignal
from integration.graph_memory import GraphMemory, GraphEntity, GraphSignal, get_graph_memory
import uuid

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    """Result from pipeline execution"""
    entities_processed: int
    signals_extracted: int
    signals_validated: int
    signals_added_to_graph: int
    errors: List[Dict[str, Any]]
    duration_seconds: float


class MVPPipeline:
    """
    End-to-End MVP Pipeline

    Flow:
    1. Entity Scheduler: Get next batch of entities to process
    2. Scrape: Fetch content for each entity (simulated for MVP)
    3. Extract: Use Claude/keywords to extract signals
    4. Validate: Apply basic validation rules
    5. Store: Save validated signals to graph memory
    6. Query: Allow querying the accumulated intelligence
    """

    def __init__(
        self,
        scheduler: EntityScheduler = None,
        extractor: SignalExtractor = None,
        graph_memory: GraphMemory = None
    ):
        """Initialize MVP pipeline"""
        self.scheduler = scheduler or EntityScheduler(graphiti_service=None)
        self.extractor = extractor or SignalExtractor(claude_client=None)
        self.graph_memory = graph_memory or get_graph_memory(backend="mock")

    async def run_batch(
        self,
        batch_size: int = 5,
        scrape_content_func: callable = None
    ) -> PipelineResult:
        """
        Run one batch through the pipeline

        Args:
            batch_size: Number of entities to process
            scrape_content_func: Optional function to scrape content
                                 (defaults to mock content generator)

        Returns:
            PipelineResult with statistics
        """
        start_time = datetime.now(timezone.utc)
        entities_processed = 0
        signals_extracted = 0
        signals_validated = 0
        signals_added_to_graph = 0
        errors = []

        logger.info(f"Starting MVP pipeline batch (size={batch_size})")

        # Step 1: Get entities to process
        entity_ids = await self.scheduler.get_next_batch(batch_size=batch_size)

        if not entity_ids:
            logger.warning("No entities to process")
            return PipelineResult(
                entities_processed=0,
                signals_extracted=0,
                signals_validated=0,
                signals_added_to_graph=0,
                errors=[],
                duration_seconds=0
            )

        logger.info(f"Processing {len(entity_ids)} entities: {entity_ids}")

        # Process each entity
        for entity_id in entity_ids:
            try:
                # Step 2: Scrape content (simulated for MVP)
                if scrape_content_func:
                    content = await scrape_content_func(entity_id)
                else:
                    content = self._generate_mock_content(entity_id)

                logger.debug(f"Scraped content for {entity_id}: {len(content)} chars")

                # Step 3: Extract signals
                extracted_signals = await self.extractor.extract_signals(
                    content=content,
                    entity_id=entity_id,
                    entity_name=entity_id.replace('_', ' ').title()
                )

                signals_extracted += len(extracted_signals)
                logger.info(f"Extracted {len(extracted_signals)} signals from {entity_id}")

                if not extracted_signals:
                    continue

                # Step 4: Validate signals
                validated_signals = self._validate_signals(extracted_signals)
                signals_validated += len(validated_signals)

                # Step 5: Add to graph memory
                for signal in validated_signals:
                    await self._add_signal_to_graph(signal, entity_id)
                    signals_added_to_graph += 1

                entities_processed += 1

            except Exception as e:
                logger.error(f"Error processing {entity_id}: {e}")
                errors.append({
                    "entity_id": entity_id,
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()

        result = PipelineResult(
            entities_processed=entities_processed,
            signals_extracted=signals_extracted,
            signals_validated=signals_validated,
            signals_added_to_graph=signals_added_to_graph,
            errors=errors,
            duration_seconds=duration
        )

        logger.info(f"Pipeline batch complete: {entities_processed} entities, "
                   f"{signals_added_to_graph} signals added, {duration:.2f}s")

        return result

    async def query_entity(
        self,
        entity_id: str,
        include_signals: bool = True
    ) -> Dict[str, Any]:
        """
        Query entity from graph memory

        Args:
            entity_id: Entity identifier
            include_signals: Whether to include signals

        Returns:
            Entity data with optional signals
        """
        entity = await self.graph_memory.get_entity(entity_id)

        if not entity:
            return {
                "entity_id": entity_id,
                "found": False,
                "message": "Entity not found in graph"
            }

        result = {
            "entity_id": entity.entity_id,
            "found": True,
            "name": entity.name,
            "type": entity.entity_type,
            "metadata": entity.metadata,
            "created_at": entity.created_at.isoformat()
        }

        if include_signals:
            signals = await self.graph_memory.get_entity_signals(entity_id)
            result["signals"] = [s.to_dict() for s in signals]
            result["signal_count"] = len(signals)

        return result

    async def query_timeline(
        self,
        entity_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Query entity timeline

        Args:
            entity_id: Entity identifier
            days: Days to look back

        Returns:
            Timeline with signals
        """
        timeline = await self.graph_memory.get_entity_timeline(entity_id, days)

        return {
            "entity_id": entity_id,
            "days": days,
            "timeline": timeline,
            "signal_count": len(timeline)
        }

    async def search_entities(
        self,
        query: str,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search entities

        Args:
            query: Search query
            entity_type: Optional type filter

        Returns:
            List of matching entities
        """
        entities = await self.graph_memory.search_entities(query, entity_type)

        return [e.to_dict() for e in entities]

    async def get_statistics(self) -> Dict[str, Any]:
        """
        Get pipeline statistics

        Returns:
            Statistics dictionary
        """
        graph_stats = await self.graph_memory.get_stats()

        return {
            "graph": graph_stats,
            "scheduler": {
                "type": "EntityScheduler",
                "freshness_window_days": 7
            },
            "extractor": {
                "type": "SignalExtractor",
                "signal_types": ["RFP_DETECTED", "EXECUTIVE_CHANGE", "PARTNERSHIP_FORMED"]
            }
        }

    def _generate_mock_content(self, entity_id: str) -> str:
        """Generate mock content for scraping simulation"""
        import random

        templates = [
            f"""{entity_id.replace('_', ' ').title()} has announced a major digital transformation initiative.
The organization is planning to issue a Request for Proposal (RFP) for a new analytics platform.
This project is estimated to be worth £1.5M and will be crucial for their data strategy.""",

            f"""Breaking: {entity_id.replace('_', ' ').title()} has appointed Jane Smith as the new Chief Technology Officer.
Jane brings 20 years of experience and will lead the club's technology innovation efforts.
This executive change signals a strong commitment to digital excellence.""",

            f"""{entity_id.replace('_', ' ').title()} has formed a strategic partnership with TechCorp.
This collaboration will focus on developing next-generation fan engagement platforms.
The partnership leverages TechCorp's AI capabilities to enhance the matchday experience."""
        ]

        return random.choice(templates)

    def _validate_signals(self, signals: List[ExtractedSignal]) -> List[ExtractedSignal]:
        """
        Validate extracted signals

        MVP Validation:
        - Confidence >= 0.6
        - Has evidence
        - Valid signal type
        """
        validated = []

        for signal in signals:
            # Check confidence threshold
            if signal.confidence < 0.6:
                logger.debug(f"Rejected signal with low confidence: {signal.confidence}")
                continue

            # Check evidence
            if not signal.evidence:
                logger.debug("Rejected signal with no evidence")
                continue

            # Signal type validation already done in extractor
            validated.append(signal)

        return validated

    async def _add_signal_to_graph(
        self,
        signal: ExtractedSignal,
        entity_id: str
    ):
        """Add signal to graph memory"""
        graph_signal = GraphSignal(
            signal_id=str(uuid.uuid4()),
            entity_id=signal.entity_id,
            signal_type=signal.signal_type,
            content=signal.content,
            confidence=signal.confidence,
            evidence=signal.evidence,
            source="MVP_Pipeline",
            metadata=signal.metadata,
            created_at=signal.extracted_at
        )

        await self.graph_memory.add_signal(graph_signal)

        # Ensure entity exists
        entity = await self.graph_memory.get_entity(entity_id)
        if not entity:
            graph_entity = GraphEntity(
                entity_id=entity_id,
                name=signal.metadata.get('entity_name', entity_id.replace('_', ' ').title()),
                entity_type="ORG",
                metadata={"created_by": "MVP_Pipeline"},
                created_at=datetime.now(timezone.utc)
            )
            await self.graph_memory.add_entity(graph_entity)
