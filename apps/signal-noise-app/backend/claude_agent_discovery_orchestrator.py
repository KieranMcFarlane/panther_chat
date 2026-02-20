#!/usr/bin/env python3
"""
Claude Agent SDK Discovery Orchestrator

Coordinated 30-iteration discovery with state management and pattern extraction.

Architecture:
1. Discovery Ledger: HTTP + state tracking across iterations
2. Claude Agent SDK: Reasoned traversal of discovered domains/channels
3. Pattern Extractor: Identify procurement signals, tech stack, governance
4. Hypothesis Scorer: Calculate confidence for procurement prediction

Usage:
    cd backend
    python3 -m claude_agent_discovery_orchestrator --entity boca_juniors
    python3 -m claude_agent_discovery_orchestrator --all --iterations 30
"""

import asyncio
import json
import logging
import argparse
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('claude_agent_discovery.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DecisionType(Enum):
    """Internal decision types for Ralph Loop"""
    ACCEPT = "ACCEPT"              # Strong evidence of procurement (+0.06)
    WEAK_ACCEPT = "WEAK_ACCEPT"    # Capability but unclear intent (+0.02)
    REJECT = "REJECT"              # Evidence contradicts hypothesis (0.00)
    NO_PROGRESS = "NO_PROGRESS"    # No new information (0.00)
    SATURATED = "SATURATED"        # Category exhausted (0.00)


@dataclass
class DiscoveryIteration:
    """Single iteration of discovery"""
    iteration_number: int
    timestamp: str
    domain_explored: str
    channel_type: str  # 'official_site', 'linkedin_jobs', 'press_release', etc.
    findings: Dict[str, Any]
    patterns_found: List[str]
    decision: str  # DecisionType value
    confidence_delta: float
    tool_calls: List[Dict[str, Any]]
    reasoning: str


@dataclass
class DiscoveryLedger:
    """State ledger for coordinated discovery across iterations"""

    entity_id: str
    entity_name: str
    total_iterations: int
    completed_iterations: int

    # State tracking
    current_confidence: float
    confidence_history: List[float]

    # Discovered content
    explored_domains: set
    explored_channels: Dict[str, List[str]]  # channel_type -> URLs

    # Pattern extraction
    procurement_signals: List[Dict[str, Any]]
    technology_stack: List[str]
    governance_patterns: List[str]

    # Hypothesis tracking
    procurement_hypothesis: str
    hypothesis_confidence: float

    # Iteration history
    iterations: List[Dict[str, Any]]

    # Cost tracking
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float

    def __init__(self, entity_id: str, entity_name: str, total_iterations: int = 30):
        self.entity_id = entity_id
        self.entity_name = entity_name
        self.total_iterations = total_iterations
        self.completed_iterations = 0

        # Initial state
        self.current_confidence = 0.0
        self.confidence_history = [0.0]

        self.explored_domains = set()
        self.explored_channels = {}

        self.procurement_signals = []
        self.technology_stack = []
        self.governance_patterns = []

        # Default hypothesis
        self.procurement_hypothesis = f"{entity_name} may have digital procurement opportunities in the next 6-12 months"
        self.hypothesis_confidence = 0.0

        self.iterations = []

        # Cost tracking (Sonnet pricing: $3/1M input, $15/1M output)
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.estimated_cost_usd = 0.0

    def add_iteration(self, iteration: DiscoveryIteration):
        """Add iteration to ledger and update state"""
        self.iterations.append(asdict(iteration))
        self.completed_iterations += 1

        # Update confidence
        self.current_confidence += iteration.confidence_delta
        self.current_confidence = max(0.0, min(1.0, self.current_confidence))  # Clamp to [0,1]
        self.confidence_history.append(self.current_confidence)

        # Update explored domains/channels
        if iteration.domain_explored:
            self.explored_domains.add(iteration.domain_explored)

        if iteration.channel_type not in self.explored_channels:
            self.explored_channels[iteration.channel_type] = []

        # Update patterns
        if iteration.decision == DecisionType.ACCEPT.value:
            self.procurement_signals.extend(iteration.patterns_found)

        # Update cost tracking
        for tool_call in iteration.tool_calls:
            self.total_input_tokens += tool_call.get('input_tokens', 0)
            self.total_output_tokens += tool_call.get('output_tokens', 0)

        # Update cost (Sonnet: $3/1M input, $15/1M output)
        self.estimated_cost_usd = (
            (self.total_input_tokens * 3 / 1_000_000) +
            (self.total_output_tokens * 15 / 1_000_000)
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert ledger to dictionary"""
        return {
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'total_iterations': self.total_iterations,
            'completed_iterations': self.completed_iterations,
            'current_confidence': self.current_confidence,
            'confidence_history': self.confidence_history,
            'explored_domains': list(self.explored_domains),
            'explored_channels': self.explored_channels,
            'procurement_signals': self.procurement_signals,
            'technology_stack': self.technology_stack,
            'governance_patterns': self.governance_patterns,
            'procurement_hypothesis': self.procurement_hypothesis,
            'hypothesis_confidence': self.hypothesis_confidence,
            'iterations': self.iterations,
            'total_input_tokens': self.total_input_tokens,
            'total_output_tokens': self.total_output_tokens,
            'estimated_cost_usd': self.estimated_cost_usd
        }


class ClaudeAgentDiscoveryOrchestrator:
    """Orchestrate coordinated Claude Agent SDK discovery"""

    def __init__(self, binding_dir: str = "data/runtime_bindings"):
        """
        Initialize orchestrator

        Args:
            binding_dir: Directory containing runtime binding JSON files
        """
        from brightdata_sdk_client import BrightDataSDKClient
        from anthropic import Anthropic

        self.binding_dir = Path(binding_dir)
        self.brightdata = BrightDataSDKClient()
        self.anthropic = Anthropic()

    async def load_binding(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Load runtime binding for entity"""
        binding_file = self.binding_dir / f"{entity_id}.json"

        if not binding_file.exists():
            logger.error(f"❌ Binding not found: {binding_file}")
            return None

        with open(binding_file, 'r') as f:
            return json.load(f)

    async def save_binding(self, entity_id: str, binding: Dict[str, Any]):
        """Save updated runtime binding"""
        binding_file = self.binding_dir / f"{entity_id}.json"

        with open(binding_file, 'w') as f:
            json.dump(binding, f, indent=2)

    async def scrape_content(self, url: str) -> Optional[str]:
        """Scrape content from URL"""
        try:
            result = await self.brightdata.scrape_as_markdown(url)

            if result['status'] == 'success':
                content = result.get('content', '')
                logger.info(f"  📄 Scraped {len(content)} characters from {url}")
                return content
            else:
                logger.warning(f"  ⚠️ Failed to scrape {url}")
                return None

        except Exception as e:
            logger.error(f"  ❌ Error scraping {url}: {e}")
            return None

    async def run_single_iteration(
        self,
        iteration_num: int,
        entity_name: str,
        target_url: str,
        channel_type: str,
        ledger: DiscoveryLedger,
        context: str
    ) -> DiscoveryIteration:
        """
        Run a single Claude Agent SDK iteration

        Args:
            iteration_num: Iteration number (1-30)
            entity_name: Entity being explored
            target_url: URL to explore
            channel_type: Type of channel
            ledger: Current discovery ledger
            context: Accumulated context from previous iterations

        Returns:
            DiscoveryIteration with findings
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"Iteration {iteration_num}/30: {channel_type}")
        logger.info(f"Target: {target_url}")
        logger.info(f"{'='*60}")

        # Scrape content
        content = await self.scrape_content(target_url)

        if not content:
            # No content - return NO_PROGRESS iteration
            return DiscoveryIteration(
                iteration_number=iteration_num,
                timestamp=datetime.now().isoformat(),
                domain_explored=target_url,
                channel_type=channel_type,
                findings={},
                patterns_found=[],
                decision=DecisionType.NO_PROGRESS.value,
                confidence_delta=0.0,
                tool_calls=[],
                reasoning="No content available for analysis"
            )

        # Build prompt for Claude
        system_prompt = f"""You are an expert procurement intelligence analyst for {entity_name}.

Your task: Analyze the scraped content for procurement signals.

Context from previous iterations:
{context}

Focus areas:
1. **Procurement Signals**: Job postings, RFPs, technology investments, digital transformation
2. **Technology Stack**: CRM, ERP, marketing automation, analytics platforms
3. **Governance Patterns**: Decision-making structure, budget cycles, vendor partnerships

Decision Types:
- ACCEPT: Strong evidence of procurement intent (+0.06 confidence)
- WEAK_ACCEPT: Capability exists but intent unclear (+0.02 confidence)
- REJECT: Evidence contradicts procurement hypothesis (0.00 confidence)
- NO_PROGRESS: No new information (0.00 confidence)
- SATURATED: Category fully explored (0.00 confidence)

Analyze the content and provide:
1. Decision type
2. Confidence delta (-0.02 to +0.06)
3. Patterns found (list)
4. Reasoning (brief explanation)
5. Key findings (dict)"""

        user_prompt = f"""Analyze this content from {target_url}:

{content[:4000]}  # First 4000 chars (token limit)

Provide analysis in JSON format:
{{
    "decision": "ACCEPT | WEAK_ACCEPT | REJECT | NO_PROGRESS | SATURATED",
    "confidence_delta": 0.00,
    "patterns_found": ["pattern1", "pattern2"],
    "reasoning": "Brief explanation",
    "findings": {{
        "technologies": [],
        "job_postings": [],
        "procurement_indicators": []
    }}
}}"""

        try:
            # Call Claude API
            start_time = time.time()

            response = self.anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                temperature=0.3,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            elapsed = time.time() - start_time

            # Extract response
            response_text = response.content[0].text

            # Parse JSON response
            try:
                analysis = json.loads(response_text)
            except json.JSONDecodeError:
                # Fallback: extract JSON from response
                import re
                match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if match:
                    analysis = json.loads(match.group(0))
                else:
                    raise ValueError("Could not parse Claude response")

            # Count tokens (approximate)
            input_tokens = len(system_prompt) / 4 + len(user_prompt) / 4
            output_tokens = len(response_text) / 4

            tool_calls = [{
                'iteration': iteration_num,
                'model': 'claude-sonnet-4',
                'input_tokens': int(input_tokens),
                'output_tokens': int(output_tokens),
                'elapsed_seconds': elapsed
            }]

            # Create iteration
            iteration = DiscoveryIteration(
                iteration_number=iteration_num,
                timestamp=datetime.now().isoformat(),
                domain_explored=target_url,
                channel_type=channel_type,
                findings=analysis.get('findings', {}),
                patterns_found=analysis.get('patterns_found', []),
                decision=analysis.get('decision', DecisionType.NO_PROGRESS.value),
                confidence_delta=analysis.get('confidence_delta', 0.0),
                tool_calls=tool_calls,
                reasoning=analysis.get('reasoning', '')
            )

            logger.info(f"  ✅ Decision: {iteration.decision}")
            logger.info(f"  📊 Confidence delta: {iteration.confidence_delta:+.3f}")
            logger.info(f"  🔍 Patterns found: {len(iteration.patterns_found)}")
            logger.info(f"  💰 Cost: ${tool_calls[0]['input_tokens'] * 3 / 1_000_000 + tool_calls[0]['output_tokens'] * 15 / 1_000_000:.4f}")

            return iteration

        except Exception as e:
            logger.error(f"  ❌ Claude API error: {e}")

            # Return NO_PROGRESS on error
            return DiscoveryIteration(
                iteration_number=iteration_num,
                timestamp=datetime.now().isoformat(),
                domain_explored=target_url,
                channel_type=channel_type,
                findings={},
                patterns_found=[],
                decision=DecisionType.NO_PROGRESS.value,
                confidence_delta=0.0,
                tool_calls=[],
                reasoning=f"Error during analysis: {e}"
            )

    async def run_discovery_for_entity(
        self,
        entity_id: str,
        num_iterations: int = 30
    ) -> Optional[DiscoveryLedger]:
        """
        Run full discovery pipeline for entity

        Args:
            entity_id: Entity ID
            num_iterations: Number of iterations (default 30)

        Returns:
            DiscoveryLedger with all iterations
        """
        # Load binding
        binding = await self.load_binding(entity_id)

        if not binding:
            return None

        entity_name = binding['entity_name']

        logger.info(f"\n{'='*60}")
        logger.info(f"🚀 Starting Claude Agent Discovery: {entity_name}")
        logger.info(f"{'='*60}")

        # Initialize ledger
        ledger = DiscoveryLedger(
            entity_id=entity_id,
            entity_name=entity_name,
            total_iterations=num_iterations
        )

        # Build exploration queue
        exploration_queue = []

        # 1. Official website (priority: high)
        for domain in binding.get('discovered_domains', []):
            exploration_queue.append({
                'url': f"https://{domain}",
                'channel_type': 'official_site',
                'priority': 1
            })

        # 2. LinkedIn jobs (priority: high)
        linkedin_jobs = binding.get('discovered_channels', {}).get('linkedin_jobs', [])
        for url in linkedin_jobs[:5]:  # Max 5 LinkedIn job URLs
            exploration_queue.append({
                'url': url,
                'channel_type': 'linkedin_jobs',
                'priority': 2
            })

        # 3. Other channels (priority: medium)
        # Future: press releases, news articles, etc.

        # Sort by priority
        exploration_queue.sort(key=lambda x: x['priority'])

        # Limit to num_iterations
        exploration_queue = exploration_queue[:num_iterations]

        # Run iterations
        context = f"Entity: {entity_name}\nInitial discovery phase."

        for idx, exploration in enumerate(exploration_queue, 1):
            iteration = await self.run_single_iteration(
                iteration_num=idx,
                entity_name=entity_name,
                target_url=exploration['url'],
                channel_type=exploration['channel_type'],
                ledger=ledger,
                context=context
            )

            # Add to ledger
            ledger.add_iteration(iteration)

            # Update context for next iteration
            context += f"\n\nIteration {idx}:"
            context += f"\n- Explored: {exploration['url']}"
            context += f"\n- Decision: {iteration.decision}"
            context += f"\n- Patterns: {', '.join(iteration.patterns_found[:3])}"
            context += f"\n- Current confidence: {ledger.current_confidence:.3f}"

            # Progress update
            logger.info(f"\n📊 Progress: [{idx}/{len(exploration_queue)}]")
            logger.info(f"   Current confidence: {ledger.current_confidence:.3f}")
            logger.info(f"   Total cost so far: ${ledger.estimated_cost_usd:.4f}")

            # Rate limiting
            if idx < len(exploration_queue):
                await asyncio.sleep(2)

        # Log summary
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ Discovery complete for {entity_name}")
        logger.info(f"{'='*60}")
        logger.info(f"Final confidence: {ledger.current_confidence:.3f}")
        logger.info(f"Procurement signals: {len(ledger.procurement_signals)}")
        logger.info(f"Domains explored: {len(ledger.explored_domains)}")
        logger.info(f"Total cost: ${ledger.estimated_cost_usd:.4f}")
        logger.info(f"Tokens: {ledger.total_input_tokens + ledger.total_output_tokens:,}")

        # Update binding with enriched patterns
        binding['enriched_patterns'] = {
            'discovery_ledger': ledger.to_dict(),
            'procurement_signals': ledger.procurement_signals,
            'technology_stack': ledger.technology_stack,
            'governance_patterns': ledger.governance_patterns,
            'procurement_hypothesis': ledger.procurement_hypothesis,
            'hypothesis_confidence': ledger.hypothesis_confidence,
            'last_updated': datetime.now().isoformat()
        }

        # Save updated binding
        await self.save_binding(entity_id, binding)

        return ledger

    async def run_batch_discovery(
        self,
        entity_ids: Optional[List[str]] = None,
        num_iterations: int = 30,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Run discovery for multiple entities

        Args:
            entity_ids: List of entity IDs (None = all)
            num_iterations: Iterations per entity
            limit: Max entities to process

        Returns:
            Summary statistics
        """
        # Get entity list
        if entity_ids:
            binding_files = [self.binding_dir / f"{eid}.json" for eid in entity_ids]
        else:
            binding_files = list(self.binding_dir.glob('*.json'))

        if limit:
            binding_files = binding_files[:limit]

        total_entities = len(binding_files)

        logger.info(f"\n{'='*60}")
        logger.info(f"🚀 Batch discovery: {total_entities} entities")
        logger.info(f"Iterations per entity: {num_iterations}")
        logger.info(f"{'='*60}\n")

        stats = {
            'total_entities': total_entities,
            'successful': 0,
            'failed': 0,
            'total_cost': 0.0,
            'total_tokens': 0,
            'high_confidence': 0,  # confidence > 0.6
            'procurement_signals': 0
        }

        for idx, binding_file in enumerate(binding_files, 1):
            try:
                entity_id = binding_file.stem

                logger.info(f"\n{'#'*60}")
                logger.info(f"# Entity {idx}/{total_entities}: {entity_id}")
                logger.info(f"{'#'*60}")

                ledger = await self.run_discovery_for_entity(
                    entity_id=entity_id,
                    num_iterations=num_iterations
                )

                if ledger:
                    stats['successful'] += 1
                    stats['total_cost'] += ledger.estimated_cost_usd
                    stats['total_tokens'] += ledger.total_input_tokens + ledger.total_output_tokens

                    if ledger.current_confidence > 0.6:
                        stats['high_confidence'] += 1

                    stats['procurement_signals'] += len(ledger.procurement_signals)
                else:
                    stats['failed'] += 1

            except Exception as e:
                logger.error(f"❌ Failed to process {entity_id}: {e}")
                stats['failed'] += 1
                continue

        # Log summary
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ Batch discovery complete!")
        logger.info(f"{'='*60}")
        logger.info(f"Total entities: {stats['total_entities']}")
        logger.info(f"Successful: {stats['successful']}")
        logger.info(f"Failed: {stats['failed']}")
        logger.info(f"High confidence (>0.6): {stats['high_confidence']}")
        logger.info(f"Total procurement signals: {stats['procurement_signals']}")
        logger.info(f"Total cost: ${stats['total_cost']:.2f}")
        logger.info(f"Total tokens: {stats['total_tokens']:,}")
        logger.info(f"{'='*60}\n")

        return stats


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Claude Agent SDK discovery orchestrator"
    )
    parser.add_argument(
        '--entity',
        type=str,
        default=None,
        help='Single entity ID to process'
    )
    parser.add_argument(
        '--entities',
        type=str,
        nargs='+',
        default=None,
        help='Multiple entity IDs to process'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Process all entities'
    )
    parser.add_argument(
        '--iterations',
        type=int,
        default=30,
        help='Iterations per entity (default: 30)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit number of entities (for testing)'
    )
    parser.add_argument(
        '--binding-dir',
        type=str,
        default='data/runtime_bindings',
        help='Path to runtime bindings directory'
    )

    args = parser.parse_args()

    # Initialize orchestrator
    orchestrator = ClaudeAgentDiscoveryOrchestrator(binding_dir=args.binding_dir)

    # Run discovery
    if args.entity:
        # Single entity
        ledger = await orchestrator.run_discovery_for_entity(
            entity_id=args.entity,
            num_iterations=args.iterations
        )

        if ledger:
            logger.info(f"✅ Discovery complete for {args.entity}")
            exit(0)
        else:
            logger.error(f"❌ Discovery failed for {args.entity}")
            exit(1)

    else:
        # Batch discovery
        entity_ids = args.entities if args.entities else None

        stats = await orchestrator.run_batch_discovery(
            entity_ids=entity_ids,
            num_iterations=args.iterations,
            limit=args.limit
        )

        # Exit with appropriate code
        if stats['failed'] > stats['successful']:
            exit(1)
        else:
            exit(0)


if __name__ == '__main__':
    asyncio.run(main())
