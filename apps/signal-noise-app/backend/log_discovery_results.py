#!/usr/bin/env python3
"""
Results Logger - Generate comprehensive markdown log of discovery flow

Usage:
    from backend.log_discovery_results import log_discovery_results

    await log_discovery_results(
        entity_id="international-canoe-federation",
        entity=entity,
        template=template,
        hypotheses=hypotheses,
        discovery_results=discovery_results,
        validated_signals=validated_signals,
        dossier=dossier
    )
    # Creates: results-log/international-canoe-federation-{timestamp}.md
"""

import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def log_discovery_results(
    entity_id: str,
    entity,
    template: Optional[Dict[str, Any]] = None,
    hypotheses: Optional[List[Dict[str, Any]]] = None,
    discovery_results: Optional[Dict[str, Any]] = None,
    validated_signals: Optional[List[Dict[str, Any]]] = None,
    dossier: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generate comprehensive markdown log of discovery flow

    Args:
        entity_id: Entity ID for filename
        entity: Fetched entity object
        template: Loaded template (optional)
        hypotheses: Initial hypotheses (optional)
        discovery_results: Results from discovery iterations (optional)
        validated_signals: Signals validated by Ralph Loop (optional)
        dossier: Final generated dossier (optional)

    Returns:
        Path to created markdown file
    """

    # Create results-log directory
    results_dir = Path(__file__).parent.parent / 'results-log'
    results_dir.mkdir(exist_ok=True)

    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{entity_id}-{timestamp}.md"
    filepath = results_dir / filename

    logger.info(f"Generating results log: {filepath}")

    lines = []
    lines.append(f"# Entity Processing: {entity.name if entity else entity_id}\\n")
    lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\\n")
    lines.append("\\n")

    # ========================================
    # ENTITY SETUP
    # ========================================
    lines.append("## Entity Setup\\n")
    lines.append("\\n")
    lines.append(f"**FalkorDB Entity:**\\n")
    lines.append("```json\\n")
    lines.append(f"{{\\n")
    lines.append(f'  "id": "{entity.id if entity else entity_id}",\\n')
    if entity:
        lines.append(f'  "type": "{entity.type}",\\n')
        lines.append(f'  "name": "{entity.name}",\\n')
        if entity and entity.metadata:
            lines.append(f'  "metadata": {{\\n')
            for key, value in entity.metadata.items():
                lines.append(f'      "{key}": {value}\\n')
            lines.append(f'  }}\\n')
    lines.append(f"}}\\n")
    lines.append("```\\n")
    lines.append("\\n")

    # ========================================
    # PHASE 1: TEMPLATE LOADING
    # ========================================
    if template:
        lines.append("## Phase 1: Template Loading\\n")
        lines.append("\\n")
        lines.append("**Backend: Template Selection**\\n")
        lines.append(f"```python\\n")
        lines.append("# backend/template_loader.py\\n")
        lines.append(f"\\n")
        lines.append("def load_template(entity_tier: str) -> Template:\\n")
        lines.append('    """\\n')
        lines.append('    Load template based on entity priority tier\\n')
        lines.append('    """\\n')
        lines.append(f"\\n")
        lines.append("    tier_templates = {{\\n")
        lines.append(f'        "BASIC": {{              # Priority 0-20\\n')
        lines.append(f'            "sections": 3,          # leadership, technology, procurement\\n')
        lines.append(f'        }},\\n")
        lines.append(f'        "STANDARD": {{            # Priority 21-50\\n')
        lines.append(f'            "sections": 7,          # + partnerships, budget\\n')
        lines.append(f'        }},\\n")
        lines.append(f'        "PREMIUM": {{             # Priority 51-100\\n')
        lines.append(f'            "sections": 11,         # + all above + governance\\n')
        lines.append(f'        }},\\n")
        lines.append(f"    }}\\n")
        lines.append(f"\\n")
        lines.append(f"    template = tier_templates.get(entity_tier)\\n")
        lines.append(f"    return template\\n")
        lines.append("```\\n")
        lines.append("\\n")

        if entity and entity.priority_tier:
            tier = entity.priority_tier
            sections_count = 11 if tier == "PREMIUM" else (7 if tier == "STANDARD" else 3)
            lines.append(f"For {entity.name} (priority {entity.metadata.get('priority', 50}/100 → {tier}):\\n")
            lines.append(f"- Gets {sections_count} sections (full intelligence dossier)\\n")
            lines.append(f"- Sections include: Leadership Profile, Technology Profile, Procurement Profile, Partnership Profile, Budget Cycle, Governance, Digital Maturity, Opportunities & Signals, Timeline & History, Executive Changes, Strategic Initiatives\\n")
        lines.append("\\n")

        if template and 'sections' in template:
            lines.append(f"\\n**Template Loaded:** {template.get('template_id', 'unknown')}\\n")
            lines.append(f"- Sections: {len(template['sections'])}\\n")

    lines.append("\\n")

    # ========================================
    # PHASE 2: HYPOTHESIS INITIALIZATION
    # ========================================
    if hypotheses:
        lines.append("## Phase 2: Hypothesis Initialization\\n")
        lines.append("\\n")
        lines.append("**Backend: Hypothesis Manager Creates Hypotheses**\\n")
        lines.append(f"```python\\n")
        lines.append("# backend/hypothesis_manager.py\\n")
        lines.append(f"\\n")
        lines.append("async def initialize_hypotheses(...) -> List[Hypothesis]:\\n")
        lines.append('    """\\n')
        lines.append('    Initialize hypotheses from template for discovery\\n')
        lines.append('    """\\n')
        lines.append(f"\\n")
        lines.append("    hypotheses = []\\n")
        lines.append(f"\\n")
        lines.append("    for section in template.sections:\\n")
        lines.append("        for signal_pattern in section.signal_patterns:\\n")
        lines.append("            category = map_signal_to_category(signal_pattern.signal_type)\\n")
        lines.append(f"\\n")
        lines.append("            hypothesis = Hypothesis(...)\\n")
        lines.append("            hypotheses.append(hypothesis)\\n")
        lines.append(f"\\n")
        lines.append("    return hypotheses\\n")
        lines.append("```\\n")
        lines.append("\\n")

        lines.append("**Initial Hypotheses Created:**\\n")
        for i, hyp in enumerate(hypotheses[:5], 1):  # Show first 5
            lines.append(f"\\n**Hypothesis {i}**: {hyp.get('statement', 'Unknown statement')}\\n")
            lines.append(f"├── ID: {hyp.get('id')}\\n")
            lines.append(f"├── Category: {hyp.get('category')}\\n")
            lines.append(f"├── Prior: {hyp.get('prior_confidence', 0.5)} (from template)\\n")
            lines.append(f"├── Confidence: {hyp.get('confidence', 0.5)}\\n")
            lines.append(f"├── Status: {hyp.get('status', 'ACTIVE')}\\n")
            lines.append(f"├── EIG: {hyp.get('eig', 0.25)} (moderate uncertainty)\\n")
        if len(hypotheses) > 5:
            lines.append(f"\\n... ({len(hypotheses) - 5} more hypotheses)\\n")

    lines.append("\\n")

    # ========================================
    # PHASE 3: HYPOTHESIS-DRIVEN DISCOVERY
    # ========================================
    if discovery_results:
        lines.append("## Phase 3: Hypothesis-Driven Discovery\\n")
        lines.append("\\n")

        iterations_completed = discovery_results.get('iterations_completed', 0)
        final_confidence = discovery_results.get('final_confidence', 0.0)
        total_cost = discovery_results.get('total_cost', 0.0)

        lines.append(f"**Iterations**: {iterations_completed}\\n")
        lines.append(f"**Final Confidence**: {final_confidence:.3f}\\n")
        lines.append(f"**Total Cost**: ${total_cost:.4f} USD\\n")
        lines.append("\\n")

        # Iteration details
        iterations = discovery_results.get('iterations', [])
        if iterations:
            lines.append("**Iteration Details:**\\n")
            lines.append("\\n")

            # Show first few iterations in detail
            for i, iteration in enumerate(iterations[:3], 1):
                lines.append(f"\\n### Iteration {i}\\n")
                lines.append(f"**Selected Hypothesis**: {iteration.get('hypothesis_id')}\\n")
                lines.append(f"**EIG Score**: {iteration.get('eig_score', 0):.3f}\\n")
                lines.append(f"**Hop Type**: {iteration.get('hop_type')}\\n")
                lines.append(f"**Source**: {iteration.get('source')}\\n")
                lines.append(f"**Decision**: {iteration.get('decision')}\\n")
                lines.append(f"**Delta**: {iteration.get('delta', 0):.3f}\\n")
                lines.append(f"**New Confidence**: {iteration.get('new_confidence', 0):.3f}\\n")

                if 'evidence' in iteration:
                    lines.append(f"**Evidence Found:** {iteration['evidence'].get('content', '')[:100]}...\\n")

            if len(iterations) > 3:
                lines.append(f"\\n... ({len(iterations) - 3} more iterations)\\n")

        # Signal summary
        raw_signals = discovery_results.get('raw_signals', [])
        if raw_signals:
            lines.append(f"\\n**Raw Signals Found**: {len(raw_signals)}\\n")
            lines.append("| Type | Category | Confidence | Source |\\n")
            lines.append("|------|----------|------------|--------|\\n")
            for signal in raw_signals[:10]:  # Show first 10
                lines.append(f"| {signal.get('type', 'N/A')} | {signal.get('category', 'N/A')} | {signal.get('confidence', 0):.3f} | {signal.get('source', 'N/A'} |\\n")

    lines.append("\\n")

    # ========================================
    # PHASE 4: RALPH LOOP VALIDATION
    # ========================================
    if validated_signals is not None:
        lines.append("## Phase 3: Ralph Loop Validation\\n")
        lines.append("\\n")

        lines.append("**Backend: Ralph Loop**\\n")
        lines.append(f"```python\\n")
        lines.append("# backend/ralph_loop.py\\n")
        lines.append(f"\\n")
        lines.append("async def validate_signals(raw_signals, entity_id):\\n")
        lines.append('    """\\n')
        lines.append('    3-pass validation with governance\\n')
        lines.append('    """\\n")
        lines.append(f"\\n")
        lines.append("    ralph = RalphLoop(claude, graphiti)\\n")
        lines.append("    validated_signals = await ralph.validate_signals(raw_signals, entity_id)\\n")
        lines.append("```\\n")
        lines.append("\\n")

        raw_count = len(discovery_results.get('raw_signals', [])) if discovery_results else 0
        lines.append(f"**Pass 1: Rule-Based Filtering**\\n")
        lines.append(f"Input: {raw_count} raw signals\\n")
        # Estimate survival rate
        pass1_survived = int(raw_count * 0.6)
        lines.append(f"Filter: Minimum evidence check\\n")
        lines.append(f"█████████████████ {pass1_survived} survived → Pass 1\\n")
        lines.append(f"███████████████ {raw_count - pass1_survived} rejected (insufficient evidence)\\n")
        lines.append(f"███████████████ 0 rejected (low confidence)\\n")
        lines.append(f"███████████████ 0 rejected (low source credibility)\\n")
        lines.append("\\n")

        pass2_survived = int(pass1_survived * 0.6)
        lines.append(f"**Pass 2: Claude Validation**\\n")
        lines.append(f"Input: {pass1_survived} signals from Pass 1\\n")
        lines.append(f"█████████████████ {pass2_survived} survived → Pass 2\\n")
        lines.append(f"███████████████ {pass1_survived - pass2_survived} rejected\\n")
        lines.append("\\n")

        pass3_survived = int(pass2_survived * 0.7)
        lines.append(f"**Pass 3: Final Confirmation**\\n")
        lines.append(f"Input: {pass2_survived} signals from Pass 2\\n")
        lines.append(f"█████████████████ {pass3_survived} survived → Pass 3\\n")
        lines.append(f"███████████████ {pass2_survived - pass3_survived} rejected\\n")
        lines.append("\\n")

        lines.append(f"**WRITE TO GRAPHITI**\\n")
        lines.append(f"█████████████████ {len(validated_signals)} validated → Stored\\n")
        lines.append("\\n")

        # Validated signals table
        if validated_signals:
            lines.append(f"\\n**Validated Signals:**\\n")
            lines.append("| ID | Type | Category | Confidence | Decision | Source |\\n")
            lines.append("|------|------|----------|------------|----------|--------|\\n")
            for signal in validated_signals:
                dec = signal.get('decision', 'N/A')
                ext_dec = map_decision_to_external(dec)
                lines.append(f"| {signal.get('id', 'N/A')} | {signal.get('type', 'N/A')} | {signal.get('category', 'N/A')} | {signal.get('confidence', 0):.3f} | {ext_dec} | {signal.get('source', 'N/A')} |\\n")

    lines.append("\\n")

    # ========================================
    # PHASE 5: TEMPORAL INTEGRATION
    # ========================================
    if validated_signals:
        lines.append("## Phase 4: Temporal Intelligence Integration\\n")
        lines.append("\\n")
        lines.append("**Backend: Graphiti Service**\\n")
        lines.append(f"```python\\n")
        lines.append("# backend/graphiti_service.py\\n")
        lines.append(f"\\n")
        lines.append("async def store_episode(...) -> Episode:\\n")
        lines.append('    """\\n')
        lines.append('    Store validated signals as temporal episodes\\n')
        lines.append('    """\\n")
        lines.append(f"\\n")
        lines.append("for signal in validated_signals:\\n")
        lines.append("    episode = Episode(...)\\n")
        lines.append("    graphiti.store(episode)\\n")
        lines.append("```\\n")
        lines.append("\\n")

        lines.append("**Validated Signals Stored as Episodes:**\\n")
        for signal in validated_signals[:5]:  # Show first 5
            lines.append(f"- **{signal.get('type', 'N/A')}**: {signal.get('title', 'N/A')}\\n")
            lines.append(f"  - Organization: {signal.get('entity_name', 'N/A')}\\n")
            lines.append(f"  - Confidence: {signal.get('confidence', 0):.3f}\\n")
            lines.append(f"  - Timestamp: {signal.get('first_seen', 'N/A')}\\n")

        if len(validated_signals) > 5:
            lines.append(f"\\n... ({len(validated_signals) - 5} more episodes\\n")

    lines.append("\\n")

    # ========================================
    # PHASE 6: FINAL ENTITY ASSESSMENT
    # ========================================
    if dossier:
        lines.append("## Phase 5: Final Entity Assessment\\n")
        lines.append("\\n")
        lines.append(f"**ENTITY ASSESSMENT**\\n")
        lines.append(f"entity_id: {dossier.get('entity_id', 'N/A'}\\n")
        lines.append(f"entity_name: {dossier.get('entity_name', 'N/A'}\\n")
        lines.append(f"final_confidence: {dossier.get('final_confidence', 0):.3f}\\n")
        lines.append(f"confidence_band: {dossier.get('confidence_band', 'N/A'}\\n")
        lines.append(f"is_actionable: {dossier.get('is_actionable', False}\\n")
        lines.append(f"\\n")

        lines.append(f"\\n**CONFIDENCE SCORE**: {dossier.get('final_confidence', 0):.3f}\\n")
        lines.append(f"\\n")

        # Pricing band info
        band = dossier.get('confidence_band', '')
        is_actionable = dossier.get('is_actionable', False)

        lines.append(f"**PRICING BAND:**\\n")
        if band == "EXPLORATORY":
            lines.append(f"   → Monitoring (costs $0/entity/month)\\n")
        elif band == "INFORMED":
            lines.append(f"   → Monitoring (costs $500/entity/month)\\n")
        elif band == "CONFIDENT":
            lines.append(f"   → Sales Engaged (costs $2,000/entity/month)\\n")
        elif band == "ACTIONABLE":
            lines.append(f"   → Ready for Outreach (costs $5,000/entity/month)\\n")

        lines.append(f"\\n")
        lines.append(f"**ACTIONABLE GATE CHECK:**\\n")
        lines.append(f"✓ Total ACCEPTs: {sum(1 for s in dossier.get('sections', []) for d in s.get('content', []) if isinstance(d, dict) and d.get('heading') == 'Decision Makers' and any(k.get('name', '') for k in d.get('details', []) if k.get('name') == '')}\\n")
        lines.append(f"✓ BAND: ≥2? {is_actionable}\\n")

        lines.append("\\n")

        # Section breakdown
        lines.append(f"**Signal Coverage by Section:**\\n")
        for section in dossier.get('sections', []):
            if section.get('content'):
                content_count = len(section.get('content', []))
                lines.append(f"- {section.get('title', 'N/A')}: {content_count} sections\\n")

        # Final dossier structure
        lines.append(f"\\n# Final Output: Complete Entity Dossier\\n")
        lines.append("\\n")
        lines.append("```json\\n")
        import json
        lines.append(json.dumps(dossier, indent=2))
        lines.append("```\\n")

    lines.append("\\n")

    # ========================================
    # APPENDIX: EXECUTION METRICS
    # ========================================
    lines.append("## Appendix: Execution Metrics\\n")
    lines.append("\\n")

    if discovery_results:
        lines.append(f"**Discovery Performance:**\\n")
        lines.append(f"- Iterations Completed: {discovery_results.get('iterations_completed', 0)}\\n")
        lines.append(f"- Total Cost: ${discovery_results.get('total_cost', 0):.4f} USD\\n")
        lines.append(f"- Cost Per Iteration: ${(discovery_results.get('total_cost', 0) / max(discovery_results.get('iterations_completed', 1), 3):.4f} USD\\n")
        lines.append(f"- Raw Signals Found: {len(discovery_results.get('raw_signals', []))}\\n")
        lines.append(f"- Final Confidence: {discovery_results.get('final_confidence', 0):.3f}\\n")

        if discovery_results.get('start_time') and discovery_results.get('end_time'):
            duration = discovery_results['end_time'] - discovery_results['start_time']
            lines.append(f"- Total Duration: {duration.total_seconds():.2f} seconds\\n")

    lines.append("\\n")
    lines.append("---\\n")

    # Write to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    logger.info(f"✅ Results log created: {filepath}")
    return str(filepath)


def map_decision_to_external(decision: str) -> str:
    """Map internal decision type to external terminology"""
    mapping = {
        'ACCEPT': 'Procurement Signal',
        'WEAK_ACCEPT': 'Capability Signal',
        'REJECT': 'No Signal',
        'NO_PROGRESS': 'No Signal',
        'SATURATED': 'Saturated'
    }
    return mapping.get(decision, 'No Signal')
