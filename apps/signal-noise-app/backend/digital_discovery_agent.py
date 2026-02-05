"""
Digital Discovery Agent

Automated digital transformation discovery for sports entities using BrightData SDK + Claude Agent SDK.

Architecture:
1. BrightData SDK for web scraping (already exists)
2. Claude Agent SDK for analysis
3. Structured discovery workflow
4. Confidence calculation
5. Batch processing

Usage:
    from backend.digital_discovery_agent import DigitalDiscoveryAgent

    agent = DigitalDiscoveryAgent()
    result = await agent.discover_entity(
        entity_name="Manchester United",
        entity_id="manchester-united-fc",
        template_id="tier_1_club_centralized_procurement"
    )
"""

import asyncio
import logging
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class DiscoverySignal:
    """A detected signal during discovery"""
    type: str  # "ACCEPT" | "WEAK_ACCEPT" | "REJECT"
    category: str  # "partnership" | "deployment" | "job_posting" | "press_release" | "capability"
    title: str  # Brief description
    evidence: str  # Supporting text/evidence
    url: str  # Source URL
    confidence: float  # Signal-specific confidence (0.0-1.0)
    date: str  # When it was detected (ISO format)
    delta: float  # Impact on overall confidence (+0.06 or +0.02)


@dataclass
class Stakeholder:
    """Identified stakeholder"""
    name: str
    role: str
    focus_area: str
    linkedin: Optional[str] = None
    email: Optional[str] = None


@dataclass
class TechnologyStack:
    """Entity's technology stack"""
    category: str  # "CRM", "Analytics", "E-commerce", "Cloud", etc.
    vendor: str  # Company providing the tech
    status: str  # "deployed", "implementing", "planned", "legacy"
    deployment_date: Optional[str] = None
    description: str = ""


@dataclass
class DiscoveryResult:
    """Complete discovery result for an entity"""
    entity_id: str
    entity_name: str
    confidence: float  # 0.0-1.0
    band: str  # "EXPLORATORY", "INFORMED", "CONFIDENT", "ACTIONABLE"
    actionable_gate: bool  # True if >=2 ACCEPTs across >=2 categories
    signals: List[DiscoverySignal]
    stakeholders: List[Stakeholder]
    technology_stack: List[TechnologyStack]
    partnerships: List[Dict[str, Any]]
    procurement_window: str  # "ACTIVE", "EMERGING", "UNKNOWN"
    priority: str  # "HIGHEST", "HIGH", "MEDIUM", "NURTURE"
    recommended_approach: str
    estimated_deal_size: str  # e.g., "£100K-£500K"
    discovery_metadata: Dict[str, Any]
    generated_at: str


class DigitalDiscoveryAgent:
    """
    Automated digital transformation discovery agent.

    Uses BrightData SDK for scraping and Claude Agent SDK for intelligent analysis.
    """

    # Confidence calculation constants
    BASE_CONFIDENCE = 0.50
    ACCEPT_DELTA = 0.06
    WEAK_ACCEPT_DELTA = 0.02

    # Confidence band definitions
    BAND_THRESHOLDS = {
        "EXPLORATORY": (0.00, 0.30),
        "INFORMED": (0.30, 0.60),
        "CONFIDENT": (0.60, 0.80),
        "ACTIONABLE": (0.80, 1.00)
    }

    def __init__(self):
        """Initialize the discovery agent"""
        import sys
        from pathlib import Path

        # Add parent directory to path for imports
        sys.path.insert(0, str(Path(__file__).parent.parent))

        from backend.brightdata_sdk_client import BrightDataSDKClient

        self.brightdata = BrightDataSDKClient()
        self._claude_client = None

    async def _get_claude(self):
        """Get or create Claude client (lazy initialization)"""
        if self._claude_client is None:
            from anthropic import Anthropic

            api_key = None
            import os
            api_key = os.getenv('ANTHROPIC_API_KEY')

            self._claude_client = Anthropic(
                api_key=api_key,
                timeout=60.0,
                max_retries=3
            )
            logger.info("✅ Claude Agent SDK client initialized")

        return self._claude_client

    async def discover_entity(
        self,
        entity_name: str,
        entity_id: str,
        template_id: Optional[str] = None,
        max_iterations: int = 4,
        depth: str = "standard"
    ) -> DiscoveryResult:
        """
        Full discovery workflow for a single entity.

        Takes ~3-5 minutes per entity with standard depth.

        Args:
            entity_name: Display name (e.g., "Manchester United FC")
            entity_id: Unique ID (e.g., "manchester-united-fc")
            template_id: Optional template to guide discovery
            max_iterations: Maximum search iterations (default: 4)
            depth: Discovery depth - "standard", "deep", or "quick"

        Returns:
            DiscoveryResult with complete analysis
        """
        logger.info(f"🚀 Starting discovery for {entity_name} (ID: {entity_id})")
        start_time = datetime.now()

        # Phase 1: Initial entity search
        logger.info("Phase 1/4: Initial entity search...")
        initial_results = await self.brightdata.search_engine(
            query=f'"{entity_name}" official website',
            engine="google",
            num_results=10
        )

        # Phase 2: Digital transformation signals
        logger.info("Phase 2/4: Digital transformation signals...")
        dt_signals = await self.brightdata.search_engine(
            query=f'"{entity_name}" digital transformation technology partnership',
            engine="google",
            num_results=10
        )

        # Phase 3: Job postings & personnel
        logger.info("Phase 3/4: Job postings & personnel...")
        job_results = await self.brightdata.search_engine(
            query=f'"{entity_name}" jobs technology digital CRM analytics',
            engine="google",
            num_results=10
        )

        # Phase 4: Press releases & partnerships
        logger.info("Phase 4/4: Press releases & partnerships...")
        press_results = await self.brightdata.search_engine(
            query=f'"{entity_name}" press release technology partnership 2024 OR 2025',
            engine="google",
            num_results=10
        )

        # Analyze with Claude
        logger.info("Analyzing with Claude Agent SDK...")
        analysis = await self._analyze_with_claude(
            entity_name=entity_id,
            entity_display_name=entity_name,
            initial_results=initial_results,
            dt_signals=dt_signals,
            job_results=job_results,
            press_results=press_results
        )

        # Calculate confidence and band
        confidence, band, actionable_gate = self._calculate_confidence(analysis['signals'])

        # Determine priority and approach
        priority, approach, deal_size = self._determine_strategy(
            confidence, band, actionable_gate, analysis
        )

        # Create result
        result = DiscoveryResult(
            entity_id=entity_id,
            entity_name=entity_name,
            confidence=confidence,
            band=band,
            actionable_gate=actionable_gate,
            signals=analysis['signals'],
            stakeholders=analysis['stakeholders'],
            technology_stack=analysis['technology_stack'],
            partnerships=analysis['partnerships'],
            procurement_window=analysis['procurement_window'],
            priority=priority,
            recommended_approach=approach,
            estimated_deal_size=deal_size,
            discovery_metadata={
                'template_id': template_id,
                'depth': depth,
                'max_iterations': max_iterations,
                'duration_seconds': (datetime.now() - start_time).total_seconds(),
                'discovery_date': datetime.now().isoformat()
            },
            generated_at=datetime.now().isoformat()
        )

        logger.info(f"✅ Discovery complete for {entity_name}")
        logger.info(f"   Confidence: {confidence:.2f} ({band})")
        logger.info(f"   Signals: {len(result.signals)} total ({len([s for s in result.signals if s.type == 'ACCEPT'])} ACCEPT)")
        logger.info(f"   Priority: {priority}")

        return result

    async def _analyze_with_claude(
        self,
        entity_name: str,
        entity_display_name: str,
        initial_results: Dict,
        dt_signals: Dict,
        job_results: Dict,
        press_results: Dict
    ) -> Dict[str, Any]:
        """
        Use Claude Agent SDK to analyze search results and extract intelligence.
        """
        claude = await self._get_claude()

        prompt = f"""You are a digital transformation expert analyzing sports entities for procurement opportunities.

**Entity**: {entity_display_name} (ID: {entity_name})

**Task**: Analyze search results and extract structured intelligence.

**Search Results to Analyze**:

1. INITIAL SEARCH RESULTS:
```json
{json.dumps(initial_results, indent=2)}
```

2. DIGITAL TRANSFORMATION SIGNALS:
```json
{json.dumps(dt_signals, indent=2)}
```

3. JOB POSTINGS:
```json
{json.dumps(job_results, indent=2)}
```

4. PRESS RELEASES:
```json
{json.dumps(press_results, indent=2)}
```

**Analysis Required**:

Extract and categorize signals into this JSON structure:

{{
  "signals": [
    {{
      "type": "ACCEPT" | "WEAK_ACCEPT" | "REJECT",
      "category": "partnership" | "deployment" | "job_posting" | "press_release" | "capability",
      "title": "Brief one-line description",
      "evidence": "Key supporting text (quote, fact, or summary)",
      "url": "Source URL if available",
      "confidence": 0.0-1.0,
      "date": "ISO date if available",
      "delta": +0.06 if ACCEPT else +0.02 if WEAK_ACCEPT else 0.00
    }}
  ],
  "stakeholders": [
    {{
      "name": "Person name",
      "role": "Job title",
      "focus_area": "What they handle",
      "linkedin": "LinkedIn URL if available",
      "email": "Email if available"
    }}
  ],
  "technology_stack": [
    {{
      "category": "CRM" | "Analytics" | "E-commerce" | "Cloud" | "Infrastructure",
      "vendor": "Company name (e.g., SAP, Deloitte, Alibaba)",
      "status": "deployed" | "implementing" | "planned" | "legacy",
      "deployment_date": "ISO date if known",
      "description": "Brief description"
    }}
  ],
  "partnerships": [
    {{
      "partner": "Company name",
      "type": "consulting" | "technology" | "infrastructure",
      "description": "Partnership details",
      "duration": "e.g., 6 years, multi-year",
      "value": "High/Medium/Low estimate"
    }}
  ],
  "procurement_window": "ACTIVE" | "EMERGING" | "UNKNOWN",
  "key_insights": "3-5 bullet points on overall digital maturity level"
}}

**Decision Framework**:

- **ACCEPT signals** (Procurement): Strong evidence of active technology procurement
  - Examples: Partnership announcements, deployments, funding allocations
  - Delta: +0.06

- **WEAK_ACCEPT** (Capability): Digital capability exists but procurement intent unclear
  - Examples: Job postings, internal tools, strategic initiatives
  - Delta: +0.02

- **REJECT**: No evidence or evidence contradicts hypothesis

Be thorough but concise. Focus on actionable intelligence for sales teams.
"""

        try:
            # Anthropic SDK is synchronous, not async
            response = claude.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                temperature=0.3,  # Lower temperature for more consistent structured output
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            content = response.content[0].text

            # Parse JSON from Claude's response
            # Look for JSON block in the response
            import re

            # Try to find JSON block
            json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1).strip()
            else:
                # Try parsing the whole content as JSON
                json_str = content.strip()

            # Clean up JSON string (remove markdown code blocks if present)
            json_str = json_str.replace('```json', '').replace('```', '').strip()

            # Parse JSON
            analysis = json.loads(json_str)

            # Validate structure
            if 'signals' not in analysis:
                raise ValueError("Missing 'signals' in analysis")

            # Convert to dataclasses
            signals = []
            for signal_data in analysis['signals']:
                signal = DiscoverySignal(**signal_data)
                signals.append(signal)

            stakeholders = []
            if 'stakeholders' in analysis:
                for stakeholder_data in analysis['stakeholders']:
                    stakeholder = Stakeholder(**stakeholder_data)
                    stakeholders.append(stakeholder)

            tech_stack = []
            if 'technology_stack' in analysis:
                for tech_data in analysis['technology_stack']:
                    tech = TechnologyStack(**tech_data)
                    tech_stack.append(tech)

            logger.info(f"✅ Claude analysis complete: {len(signals)} signals, {len(stakeholders)} stakeholders")

            # Return with converted dataclass objects, not raw dict
            return {
                'signals': signals,
                'stakeholders': stakeholders,
                'technology_stack': tech_stack,
                'partnerships': analysis.get('partnerships', []),
                'procurement_window': analysis.get('procurement_window', 'UNKNOWN'),
                'summary': analysis.get('summary', ''),
                'overall_assessment': analysis.get('overall_assessment', '')
            }

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse Claude JSON response: {e}")
            logger.debug(f"Claude response: {content[:500]}...")
            raise
        except Exception as e:
            logger.error(f"❌ Claude analysis failed: {e}")
            raise

    def _calculate_confidence(
        self,
        signals: List[DiscoverySignal]
    ) -> tuple[float, str, bool]:
        """
        Calculate confidence score and band from signals.

        Returns:
            (confidence, band, actionable_gate)
        """
        # Start with base confidence
        confidence = self.BASE_CONFIDENCE

        # Count signal types
        accept_count = sum(1 for s in signals if s.type == "ACCEPT")
        weak_accept_count = sum(1 for s in signals if s.type == "WEAK_ACCEPT")

        # Apply deltas
        confidence += (accept_count * self.ACCEPT_DELTA)
        confidence += (weak_accept_count * self.WEAK_ACCEPT_DELTA)

        # Enforce bounds
        confidence = max(0.0, min(1.0, confidence))

        # Determine band
        band = "EXPLORATORY"
        for band_name, (low, high) in self.BAND_THRESHOLDS.items():
            if low <= confidence < high:
                band = band_name
                break
        else:
            band = "ACTIONABLE"  # 0.80+

        # Determine actionable gate
        # Need >=2 ACCEPTs across >=2 categories
        accept_by_category = {}
        for signal in signals:
            if signal.type == "ACCEPT":
                accept_by_category[signal.category] = accept_by_category.get(signal.category, 0) + 1

        categories_with_accepts = sum(1 for count in accept_by_category.values() if count >= 2)
        actionable_gate = categories_with_accepts >= 2

        return confidence, band, actionable_gate

    def _determine_strategy(
        self,
        confidence: float,
        band: str,
        actionable_gate: bool,
        analysis: Dict
    ) -> tuple[str, str, str]:
        """Determine priority, approach, and deal size"""

        # Priority based on confidence and signals
        if confidence >= 0.90:
            priority = "HIGHEST"
        elif confidence >= 0.80:
            priority = "HIGH"
        elif confidence >= 0.60:
            priority = "MEDIUM"
        else:
            priority = "NURTURE" if confidence >= 0.30 else "LOW"

        # Approach based on gate and partnerships
        if actionable_gate:
            approach = "Direct outreach with co-sell opportunities"
        elif band == "INFORMED":
            approach = "Nurture with education and benchmarking"
        else:
            approach = "Monitor for signals and engage thoughtfully"

        # Deal size estimation (heuristic)
        accept_signals = [s for s in analysis.get('signals', []) if s.type == 'ACCEPT']

        if len(accept_signals) >= 5 and confidence >= 0.90:
            deal_size = "£1M-5M+"
        elif len(accept_signals) >= 3 and confidence >= 0.80:
            deal_size = "£500K-£1M"
        elif confidence >= 0.70:
            deal_size = "£250K-£500K"
        elif confidence >= 0.50:
            deal_size = "£100K-£250K"
        else:
            deal_size = "<£100K (future)"

        return priority, approach, deal_size


# =============================================================================
# Multi-Agent System Integration
# =============================================================================

# Check if multi-agent system is enabled via environment variable
USE_MULTI_AGENT = os.getenv('USE_MULTI_AGENT', 'false').lower() == 'true'

if USE_MULTI_AGENT:
    # Import multi-agent adapter
    from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter

    # Replace DigitalDiscoveryAgent with multi-agent version
    # This maintains backward compatibility while using the new system
    DigitalDiscoveryAgent = DigitalDiscoveryAgentAdapter

    logger.info("✅ Multi-agent system enabled via USE_MULTI_AGENT=true")
else:
    logger.info("ℹ️  Using legacy DigitalDiscoveryAgent")


class BatchDigitalDiscovery:
    """
    Batch processing for multiple entities.

    Processes entities in parallel for scalability.
    """

    def __init__(self):
        """Initialize batch discovery"""
        self.agent = DigitalDiscoveryAgent()

    async def discover_entities(
        self,
        entities: List[Dict[str, str]],
        max_concurrent: int = 5
    ) -> List[DiscoveryResult]:
        """
        Discover multiple entities in parallel.

        Args:
            entities: List of dicts with 'name' and 'id' keys
            max_concurrent: Maximum concurrent discoveries (default: 5)

        Returns:
            List of DiscoveryResults
        """
        logger.info(f"🚀 Starting batch discovery for {len(entities)} entities (max concurrent: {max_concurrent})")
        start_time = datetime.now()

        # Create semaphore to limit concurrency
        import asyncio
        semaphore = asyncio.Semaphore(max_concurrent)

        async def discover_with_limit(entity_data):
            async with semaphore:
                try:
                    return await self.agent.discover_entity(
                        entity_name=entity_data['name'],
                        entity_id=entity_data['id']
                    )
                except Exception as e:
                    logger.error(f"❌ Discovery failed for {entity_data['name']}: {e}")
                    return None

        # Process all entities in parallel
        results = await asyncio.gather(*[
            discover_with_limit(entity_data)
            for entity_data in entities
        ])

        # Filter out failures
        successful_results = [r for r in results if r is not None]

        duration = (datetime.now() - start_time).total_seconds()

        logger.info(f"✅ Batch discovery complete: {len(successful_results)}/{len(entities)} successful")
        logger.info(f"   Duration: {duration:.1f} seconds ({duration/len(successful_results):.1f} seconds per entity)")

        # Generate summary report
        summary = self._generate_summary(successful_results, duration)

        return successful_results

    def _generate_summary(
        self,
        results: List[DiscoveryResult],
        duration_seconds: float
    ) -> Dict[str, Any]:
        """Generate summary report from batch results"""

        high_priority = [r for r in results if r.priority in ["HIGHEST", "HIGH"]]
        confident = [r for r in results if r.confidence >= 0.80]
        actionable = [r for r in results if r.actionable_gate]

        summary = {
            "total_entities": len(results),
            "high_priority_count": len(high_priority),
            "confident_count": len(confident),
            "actionable_count": len(actionable),
            "average_confidence": sum(r.confidence for r in results) / len(results) if results else 0.0,
            "duration_seconds": duration_seconds,
            "avg_time_per_entity": duration_seconds / len(results) if results else 0.0,
            "priority_breakdown": {
                "HIGHEST": len([r for r in results if r.priority == "HIGHEST"]),
                "HIGH": len([r for r in results if r.priority == "HIGH"]),
                "MEDIUM": len([r for r in results if r.priority == "MEDIUM"]),
                "LOW": len([r for r in results if r.priority == "LOW"]),
                "NURTURE": len([r for r in results if r.priority == "NURTURE"])
            },
            "band_breakdown": {
                "ACTIONABLE": len([r for r in results if r.band == "ACTIONABLE"]),
                "CONFIDENT": len([r for r in results if r.band == "CONFIDENT"]),
                "INFORMED": len([r for r in results if r.band == "INFORMED"]),
                "EXPLORATORY": len([r for r in results if r.band == "EXPLORATORY"])
            },
            "estimated_pipeline_value": self._estimate_pipeline_value(results)
        }

        return summary

    def _estimate_pipeline_value(self, results: List[DiscoveryResult]) -> str:
        """Estimate weighted pipeline value based on confidence and priority"""

        value_estimates = {
            "HIGHEST": 1250000,  # £1.25M
            "HIGH": 625000,    # £625K
            "MEDIUM": 300000,   # £300K
            "LOW": 100000,     # £100K
            "NURTURE": 37500    # £37.5K
        }

        total_value = sum(
            value_estimates.get(r.priority, 0) * (r.confidence if r.confidence < 1.0 else 0.95)
            for r in results
        )

        return f"£{total_value:,.0f} (~£{total_value/1_000:,.0f}K)"


# CLI interface for testing
async def main():
    """Test digital discovery agent"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python digital_discovery_agent.py <entity_name> <entity_id>")
        print("Example: python digital_discovery_agent.py 'Manchester United' 'manchester-united-fc'")
        sys.exit(1)

    entity_name = sys.argv[1]
    entity_id = sys.argv[2]

    agent = DigitalDiscoveryAgent()

    result = await agent.discover_entity(
        entity_name=entity_name,
        entity_id=entity_id
    )

    # Output summary
    print(f"\n{'='*60}")
    print(f"DISCOVERY RESULT: {result.entity_name}")
    print(f"{'='*60}")
    print(f"Confidence: {result.confidence:.2f} ({result.band})")
    print(f"Actionable Gate: {'✅ PASSED' if result.actionable_gate else '❌ NOT PASSED'}")
    print(f"Priority: {result.priority}")
    print(f"Approach: {result.recommended_approach}")
    print(f"Estimated Deal Size: {result.estimated_deal_size}")
    print(f"\nSignals ({len(result.signals)}):")
    for signal in result.signals[:10]:  # Show first 10
        print(f"  [{signal.type}] {signal.title}")

    print(f"\nStakeholders ({len(result.stakeholders)}):")
    for stakeholder in result.stakeholders[:5]:
        print(f"  • {stakeholder.name} - {stakeholder.role}")

    if result.partnerships:
        print(f"\nPartnerships ({len(result.partnerships)}):")
        for partner in result.partnerships[:3]:
            print(f"  • {partner.get('partner', 'Unknown')}: {partner.get('description', 'No description')}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
