"""
Batch Query Optimization for Hypothesis System

Implements efficient batch operations for querying and updating
hypotheses across thousands of entities.

Features:
- Chunked queries (100 entities per chunk)
- Parallel execution with concurrency limits
- Optimized Cypher with UNWIND and IN clauses
- Result streaming for memory efficiency
- Connection pooling

Part of Phase 5: Scalable Schema
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
from falkordb import GraphDatabase

logger = logging.getLogger(__name__)


@dataclass
class BatchConfig:
    """Configuration for batch operations"""
    chunk_size: int = 100  # Entities per chunk
    max_concurrent: int = 10  # Max parallel operations
    timeout_seconds: int = 300  # Query timeout
    stream_enabled: bool = True  # Enable result streaming


@dataclass
class BatchResult:
    """Result of a batch operation"""
    total_processed: int = 0
    successful: int = 0
    failed: int = 0
    errors: List[str] = field(default_factory=list)
    duration_seconds: float = 0.0

    @property
    def success_rate(self) -> float:
        """Calculate success rate"""
        return self.successful / self.total_processed if self.total_processed > 0 else 0.0


class BatchHypothesisQuery:
    """
    Optimized batch query operations for hypotheses.

    Provides efficient methods for querying and updating
    hypotheses across thousands of entities with proper
    chunking, parallelization, and connection pooling.
    """

    def __init__(
        self,
        repository,
        config: BatchConfig = None
    ):
        """
        Initialize batch query handler.

        Args:
            repository: HypothesisRepository instance
            config: Batch configuration
        """
        self.repo = repository
        self.config = config or BatchConfig()
        self._semaphore = asyncio.Semaphore(self.config.max_concurrent)

        logger.info(
            f"Initialized BatchHypothesisQuery: "
            f"chunk_size={self.config.chunk_size}, "
            f"max_concurrent={self.config.max_concurrent}"
        )

    async def get_hypotheses_batch(
        self,
        entity_ids: List[str],
        template_id: Optional[str] = None
    ) -> Dict[str, List[Any]]:
        """
        Get hypotheses for multiple entities in batch.

        Args:
            entity_ids: List of entity IDs
            template_id: Optional template filter

        Returns:
            Dict mapping entity_id to list of hypotheses
        """
        start_time = datetime.now()
        result = BatchResult()
        results_dict = {}

        # Split into chunks
        chunks = self._chunk_list(entity_ids, self.config.chunk_size)

        # Process chunks in parallel
        tasks = [
            self._get_hypotheses_chunk(chunk, template_id)
            for chunk in chunks
        ]

        chunk_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Aggregate results
        for chunk_result in chunk_results:
            if isinstance(chunk_result, Exception):
                result.failed += len(chunk_results[0]) if chunk_results else 0
                result.errors.append(str(chunk_result))
                logger.error(f"Chunk failed: {chunk_result}")
            else:
                results_dict.update(chunk_result)
                result.successful += len(chunk_result)

        result.total_processed = len(entity_ids)
        result.duration_seconds = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"Batch query completed: "
            f"{result.successful}/{result.total_processed} entities "
            f"in {result.duration_seconds:.2f}s"
        )

        return results_dict

    async def _get_hypotheses_chunk(
        self,
        entity_ids: List[str],
        template_id: Optional[str] = None
    ) -> Dict[str, List[Any]]:
        """
        Process a single chunk of entities.

        Args:
            entity_ids: List of entity IDs (chunk)
            template_id: Optional template filter

        Returns:
            Dict mapping entity_id to hypotheses
        """
        async with self._semaphore:
            try:
                # Use optimized Cypher query
                query = self._build_batch_query(entity_ids, template_id)

                # Execute query
                driver = self.repo.driver
                async with driver.session(database=self.repo.database) as session:
                    result = await session.run(query, entity_ids=entity_ids)

                    # Group results by entity_id
                    grouped = {}
                    async for record in result:
                        entity_id = record["entity_id"]
                        hypothesis = self._record_to_hypothesis(record)

                        if entity_id not in grouped:
                            grouped[entity_id] = []
                        grouped[entity_id].append(hypothesis)

                    return grouped

            except Exception as e:
                logger.error(f"Chunk query failed: {e}")
                raise

    def _build_batch_query(self, entity_ids: List[str], template_id: Optional[str] = None) -> str:
        """
        Build optimized Cypher query for batch retrieval.

        Uses IN clause for efficient filtering.
        """
        # Base query with IN clause
        query = """
        MATCH (h:Hypothesis)-[:ABOUT_ENTITY]->(e:Entity)
        WHERE e.id IN $entity_ids
        """

        # Add template filter if specified
        if template_id:
            query += f" AND h.template_id = '{template_id}'"

        # Return structure
        query += """
        RETURN e.id AS entity_id, h AS hypothesis
        ORDER BY e.id, h.confidence DESC
        """

        return query

    def _record_to_hypothesis(self, record) -> Any:
        """
        Convert Neo4j record to Hypothesis object.

        Args:
            record: Neo4j record

        Returns:
            Hypothesis object
        """
        # Import here to avoid circular dependency
        from backend.hypothesis_manager import Hypothesis

        node = record["hypothesis"]
        return Hypothesis(
            hypothesis_id=node.get("hypothesis_id"),
            entity_id=node.get("entity_id"),
            template_id=node.get("template_id"),
            category=node.get("category"),
            target_entity_type=node.get("target_entity_type"),
            confidence=node.get("confidence", 0.0),
            state=node.get("state", "ACTIVE"),
            metadata=node.get("metadata", {}),
            iterations=node.get("iterations", 0),
            reinforcement_count=node.get("reinforcement_count", 0),
            last_tested_timestamp=node.get("last_tested_timestamp"),
            created_timestamp=node.get("created_timestamp")
        )

    async def update_confidences_batch(
        self,
        updates: List[Dict[str, float]]
    ) -> int:
        """
        Batch update hypothesis confidences using UNWIND.

        Args:
            updates: List of {hypothesis_id, confidence_delta} dicts

        Returns:
            Number of hypotheses successfully updated
        """
        start_time = datetime.now()
        result = BatchResult()

        if not updates:
            return 0

        # Split into chunks
        chunks = self._chunk_list(updates, self.config.chunk_size)

        # Process chunks in parallel
        tasks = [self._update_confidences_chunk(chunk) for chunk in chunks]
        chunk_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Aggregate results
        for chunk_result in chunk_results:
            if isinstance(chunk_result, Exception):
                result.failed += self.config.chunk_size
                result.errors.append(str(chunk_result))
            else:
                result.successful += chunk_result

        result.total_processed = len(updates)
        result.duration_seconds = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"Batch update completed: "
            f"{result.successful}/{result.total_processed} hypotheses "
            f"in {result.duration_seconds:.2f}s"
        )

        return result.successful

    async def _update_confidences_chunk(self, updates: List[Dict[str, float]]) -> int:
        """
        Update confidences for a chunk using UNWIND.

        Args:
            updates: List of updates

        Returns:
            Number of successful updates
        """
        async with self._semaphore:
            try:
                driver = self.repo.driver
                async with driver.session(database=self.repo.database) as session:
                    # Use UNWIND for efficient batch updates
                    query = """
                    UNWIND $updates AS update
                    MATCH (h:Hypothesis {hypothesis_id: update.hypothesis_id})
                    SET h.confidence = h.confidence + update.confidence_delta,
                        h.last_tested_timestamp = datetime()
                    RETURN count(h) AS updated_count
                    """

                    result = await session.run(query, updates=updates)
                    record = await result.single()
                    return record["updated_count"] if record else 0

            except Exception as e:
                logger.error(f"Chunk update failed: {e}")
                raise

    async def stream_entity_assessments(
        self,
        entity_ids: List[str],
        callback
    ) -> BatchResult:
        """
        Stream entity assessments as they are computed.

        Memory-efficient alternative to loading all results.

        Args:
            entity_ids: List of entity IDs
            callback: Async function to call with each result

        Returns:
            Batch result summary
        """
        start_time = datetime.now()
        result = BatchResult()

        # Split into chunks
        chunks = self._chunk_list(entity_ids, self.config.chunk_size)

        # Process chunks sequentially but stream results
        for chunk in chunks:
            try:
                chunk_results = await self._get_hypotheses_chunk(chunk)

                # Stream results via callback
                for entity_id, hypotheses in chunk_results.items():
                    await callback(entity_id, hypotheses)
                    result.successful += 1

            except Exception as e:
                result.failed += len(chunk)
                result.errors.append(str(e))
                logger.error(f"Stream chunk failed: {e}")

        result.total_processed = len(entity_ids)
        result.duration_seconds = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"Stream completed: "
            f"{result.successful}/{result.total_processed} entities "
            f"in {result.duration_seconds:.2f}s"
        )

        return result

    async def create_hypotheses_batch(
        self,
        hypotheses: List[Any]
    ) -> int:
        """
        Batch create hypotheses using UNWIND.

        Args:
            hypotheses: List of Hypothesis objects to create

        Returns:
            Number of hypotheses successfully created
        """
        start_time = datetime.now()
        result = BatchResult()

        if not hypotheses:
            return 0

        # Convert to dict format for Cypher
        hypothesis_dicts = []
        for h in hypotheses:
            from dataclasses import asdict
            hypothesis_dicts.append(asdict(h))

        # Split into chunks
        chunks = self._chunk_list(hypothesis_dicts, self.config.chunk_size)

        # Process chunks in parallel
        tasks = [self._create_hypotheses_chunk(chunk) for chunk in chunks]
        chunk_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Aggregate results
        for chunk_result in chunk_results:
            if isinstance(chunk_result, Exception):
                result.failed += self.config.chunk_size
                result.errors.append(str(chunk_result))
            else:
                result.successful += chunk_result

        result.total_processed = len(hypotheses)
        result.duration_seconds = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"Batch create completed: "
            f"{result.successful}/{result.total_processed} hypotheses "
            f"in {result.duration_seconds:.2f}s"
        )

        return result.successful

    async def _create_hypotheses_chunk(self, hypotheses: List[Dict]) -> int:
        """
        Create hypotheses for a chunk using UNWIND.

        Args:
            hypotheses: List of hypothesis dicts

        Returns:
            Number of successful creations
        """
        async with self._semaphore:
            try:
                driver = self.repo.driver
                async with driver.session(database=self.repo.database) as session:
                    # Use UNWIND for efficient batch creates
                    query = """
                    UNWIND $hypotheses AS h
                    MERGE (hyp:Hypothesis {hypothesis_id: h.hypothesis_id})
                    SET hyp.entity_id = h.entity_id,
                        hyp.template_id = h.template_id,
                        hyp.category = h.category,
                        hyp.target_entity_type = h.target_entity_type,
                        hyp.confidence = h.confidence,
                        hyp.state = h.state,
                        hyp.metadata = h.metadata,
                        hyp.iterations = h.iterations,
                        hyp.reinforcement_count = h.reinforcement_count,
                        hyp.last_tested_timestamp = h.last_tested_timestamp,
                        hyp.created_timestamp = h.created_timestamp
                    RETURN count(hyp) AS created_count
                    """

                    result = await session.run(query, hypotheses=hypotheses)
                    record = await result.single()
                    return record["created_count"] if record else 0

            except Exception as e:
                logger.error(f"Chunk create failed: {e}")
                raise

    def _chunk_list(self, items: List, chunk_size: int) -> List[List]:
        """
        Split list into chunks.

        Args:
            items: List to chunk
            chunk_size: Size of each chunk

        Returns:
            List of chunks
        """
        chunks = []
        for i in range(0, len(items), chunk_size):
            chunks.append(items[i:i + chunk_size])
        return chunks

    async def benchmark_query_performance(
        self,
        entity_ids: List[str],
        iterations: int = 3
    ) -> Dict[str, float]:
        """
        Benchmark batch query performance.

        Args:
            entity_ids: List of entity IDs to test
            iterations: Number of test iterations

        Returns:
            Dict with performance metrics
        """
        logger.info(f"Starting benchmark: {len(entity_ids)} entities, {iterations} iterations")

        timings = []

        for i in range(iterations):
            start = datetime.now()
            await self.get_hypotheses_batch(entity_ids)
            duration = (datetime.now() - start).total_seconds()
            timings.append(duration)
            logger.info(f"Iteration {i+1}/{iterations}: {duration:.2f}s")

        avg_time = sum(timings) / len(timings)
        min_time = min(timings)
        max_time = max(timings)
        throughput = len(entity_ids) / avg_time

        metrics = {
            "avg_time_seconds": avg_time,
            "min_time_seconds": min_time,
            "max_time_seconds": max_time,
            "throughput_entities_per_second": throughput,
            "entities_per_query": len(entity_ids)
        }

        logger.info(f"Benchmark results: {metrics}")
        return metrics
