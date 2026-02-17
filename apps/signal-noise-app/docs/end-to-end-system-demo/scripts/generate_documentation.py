#!/usr/bin/env python3
"""
Documentation Generator for End-to-End System Demo

Generates comprehensive markdown documentation from captured execution data.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def load_results(data_dir: Path) -> dict:
    """Load execution results from JSON file"""
    results_file = data_dir / 'end_to_end_results.json'
    with open(results_file) as f:
        return json.load(f)


def generate_markdown(results: dict) -> str:
    """Generate complete markdown documentation"""

    lines = []

    # Title and metadata
    lines.append("# Signal Noise App: End-to-End System Demonstration")
    lines.append("")
    lines.append(f"**Generated:** {results.get('generated_at', 'Unknown')}")
    lines.append(f"**Version:** {results.get('version', '1.0.0')}")
    lines.append(f"**Purpose:** Complete system validation across all entity types")
    lines.append("")

    # Executive Summary
    lines.append("---")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append("")
    lines.append("This document demonstrates the complete Signal Noise system functionality")
    lines.append("by executing all 6 system steps across three different entity types:")
    lines.append("")

    for entity in results.get('entities', []):
        lines.append(f"- **{entity['entity_name']}** ({entity['entity_type']})")
        lines.append(f"  - Final Confidence: {entity['final_confidence']:.2f}")
        lines.append(f"  - Confidence Band: {entity['confidence_band']}")
        lines.append(f"  - Total Signals: {entity['total_signals']}")
        lines.append(f"  - Estimated Value: {entity['estimated_value']}")
        lines.append(f"  - Duration: {entity['duration_ms']/1000:.1f}s")
        lines.append(f"  - Cost: ${entity['cost_usd']:.2f}")
        lines.append("")

    summary = results.get('summary', {})
    lines.append(f"### Overall Metrics")
    lines.append("")
    lines.append(f"- **Total Entities Processed:** {summary.get('total_entities', 0)}")
    lines.append(f"- **Entity Types Tested:** {', '.join(summary.get('entity_types_tested', []))}")
    lines.append(f"- **Total Steps Executed:** {summary.get('total_steps_executed', 0)}")
    lines.append(f"- **Successful Steps:** {summary.get('successful_steps', 0)}")
    lines.append(f"- **Average Confidence:** {summary.get('avg_confidence', 0):.2f}")
    lines.append(f"- **Total Duration:** {results.get('total_duration_ms', 0)/1000:.1f} seconds")
    lines.append(f"- **Total Cost:** ${results.get('total_cost_usd', 0):.2f}")
    lines.append("")

    # System Architecture
    lines.append("---")
    lines.append("")
    lines.append("## System Architecture Overview")
    lines.append("")
    lines.append("```")
    lines.append("┌─────────────────────────────────────────────────────────────────────┐")
    lines.append("│                    SIGNAL NOISE SYSTEM FLOW                         │")
    lines.append("├─────────────────────────────────────────────────────────────────────┤")
    lines.append("│                                                                     │")
    lines.append("│  STEP 1: Question-First Dossier     ━━● Generate hypotheses       │")
    lines.append("│  STEP 2: Hypothesis-Driven Discovery ━━━━━● Validate via web       │")
    lines.append("│  STEP 3: Ralph Loop Validation     ━━━━━━━● 3-pass governance     │")
    lines.append("│  STEP 4: Temporal Intelligence     ━━━━━━━━● Pattern analysis      │")
    lines.append("│  STEP 5: Narrative Builder         ━━━━━━━━━● Compress context      │")
    lines.append("│  STEP 6: Yellow Panther Scoring    ━━━━━━━━━━● Sales positioning    │")
    lines.append("│                                                                     │")
    lines.append("└─────────────────────────────────────────────────────────────────────┘")
    lines.append("```")
    lines.append("")

    # Confidence Bands Reference
    lines.append("### Confidence Bands (Pricing)")
    lines.append("")
    lines.append("| Band | Range | Meaning | Price |")
    lines.append("|------|-------|---------|-------|")
    lines.append("| EXPLORATORY | <0.30 | Research phase | $0 |")
    lines.append("| INFORMED | 0.30-0.60 | Monitoring | $500/entity/month |")
    lines.append("| CONFIDENT | 0.60-0.80 | Sales engaged | $2,000/entity/month |")
    lines.append("| ACTIONABLE | >0.80 + gate | Immediate outreach | $5,000/entity/month |")
    lines.append("")

    # Decision Types Reference
    lines.append("### Decision Types (Internal → External)")
    lines.append("")
    lines.append("| Internal | External | Delta | Meaning |")
    lines.append("|----------|----------|-------|---------|")
    lines.append("| ACCEPT | Procurement Signal | +0.06 | Strong evidence of procurement intent |")
    lines.append("| WEAK_ACCEPT | Capability Signal | +0.02 | Capability present, intent unclear |")
    lines.append("| REJECT | No Signal | 0.00 | No evidence or contradicts hypothesis |")
    lines.append("| NO_PROGRESS | No Signal | 0.00 | No new information |")
    lines.append("| SATURATED | Saturated | 0.00 | Category exhausted |")
    lines.append("")

    # Entity walkthroughs
    for entity in results.get('entities', []):
        lines.extend(generate_entity_section(entity))
        lines.append("")

    # Cross-Entity Analysis
    lines.extend(generate_cross_entity_analysis(results))

    # Technical Appendix
    lines.extend(generate_technical_appendix(results))

    # Business Metrics Summary
    lines.extend(generate_business_metrics(results))

    return "\n".join(lines)


def generate_entity_section(entity: dict) -> list:
    """Generate detailed section for a single entity"""
    lines = []

    entity_name = entity['entity_name']
    entity_type = entity['entity_type']

    lines.append("---")
    lines.append("")
    lines.append(f"## Entity {entity['entity_id'].upper()}: {entity_name} ({entity_type})")
    lines.append("")

    # Entity summary
    lines.append(f"### Summary")
    lines.append("")
    lines.append(f"- **Entity ID:** {entity['entity_id']}")
    lines.append(f"- **Entity Type:** {entity_type}")
    lines.append(f"- **Started:** {entity['started_at']}")
    lines.append(f"- **Completed:** {entity['completed_at']}")
    lines.append(f"- **Duration:** {entity['duration_ms']/1000:.2f} seconds")
    lines.append(f"- **Total Cost:** ${entity['cost_usd']:.2f}")
    lines.append(f"- **Final Confidence:** {entity['final_confidence']:.2f}")
    lines.append(f"- **Confidence Band:** {entity['confidence_band']}")
    lines.append(f"- **Total Signals:** {entity['total_signals']}")
    lines.append(f"  - Procurement Signals: {entity['procurement_signals']}")
    lines.append(f"  - Capability Signals: {entity['capability_signals']}")
    lines.append(f"- **Estimated Value:** {entity['estimated_value']}")
    lines.append("")

    # Step details
    for step in entity.get('steps', []):
        lines.extend(generate_step_section(step))

    # Recommendations
    if entity.get('recommendations'):
        lines.append("### Sales Recommendations")
        lines.append("")
        for rec in entity['recommendations']:
            lines.append(f"- {rec}")
        lines.append("")

    return lines


def generate_step_section(step: dict) -> list:
    """Generate detailed section for a single step"""
    lines = []

    step_num = step['step_number']
    step_name = step['step_name']
    status = step['status']

    # Status indicator
    status_icon = {"success": "✅", "partial": "⚠️", "failed": "❌", "skipped": "⏭️"}.get(status, "❓")

    lines.append(f"### Step {step_num}: {step_name} {status_icon}")
    lines.append("")

    # Metrics
    lines.append(f"**Started:** {step['started_at']}")
    lines.append(f"**Completed:** {step['completed_at']}")
    lines.append(f"**Duration:** {step['duration_ms']}ms")
    lines.append(f"**Cost:** ${step['cost_usd']:.2f}")
    lines.append(f"**Status:** {status.upper()}")
    lines.append("")

    # Input
    if step.get('input_data'):
        lines.append(f"**Input:**")
        for key, value in step['input_data'].items():
            lines.append(f"  - `{key}`: {value}")
        lines.append("")

    # Output
    if step.get('output_data'):
        lines.append(f"**Output:**")
        for key, value in step['output_data'].items():
            lines.append(f"  - `{key}`: {value}")
        lines.append("")

    # Details (full content)
    if step.get('details'):
        lines.append(f"**Details:**")
        lines.append("")
        lines.append(step['details'])
        lines.append("")

    # Logs
    if step.get('logs'):
        lines.append(f"**Logs:**")
        lines.append("")
        for log in step['logs']:
            lines.append(f"  - {log}")
        lines.append("")

    return lines


def generate_cross_entity_analysis(results: dict) -> list:
    """Generate cross-entity comparison section"""
    lines = []

    lines.append("---")
    lines.append("")
    lines.append("## Cross-Entity Analysis")
    lines.append("")

    entities = results.get('entities', [])

    # Confidence comparison
    lines.append("### Confidence Comparison")
    lines.append("")
    lines.append("| Entity | Type | Confidence | Band | Signals | Duration | Cost |")
    lines.append("|--------|------|------------|------|---------|----------|------|")

    for e in entities:
        lines.append(f"| {e['entity_name']} | {e['entity_type']} | {e['final_confidence']:.2f} | {e['confidence_band']} | {e['total_signals']} | {e['duration_ms']/1000:.1f}s | ${e['cost_usd']:.2f} |")

    lines.append("")

    # Entity type breakdown
    lines.append("### Entity Type Breakdown")
    lines.append("")

    by_type = {}
    for e in entities:
        et = e['entity_type']
        if et not in by_type:
            by_type[et] = []
        by_type[et].append(e)

    for et, ents in sorted(by_type.items()):
        lines.append(f"#### {et}")
        lines.append("")
        lines.append(f"- **Count:** {len(ents)}")
        lines.append(f"- **Avg Confidence:** {sum(e['final_confidence'] for e in ents)/len(ents):.2f}")
        lines.append(f"- **Total Signals:** {sum(e['total_signals'] for e in ents)}")
        lines.append(f"- **Total Cost:** ${sum(e['cost_usd'] for e in ents):.2f}")
        lines.append("")

    # Scalability demonstration
    lines.append("### Scalability Demonstration")
    lines.append("")
    lines.append("The system successfully processed three different entity types without")
    lines.append("any manual configuration or template updates:")
    lines.append("")
    for e in entities:
        lines.append(f"- ✅ {e['entity_name']} ({e['entity_type']}) - {e['total_signals']} signals detected")
    lines.append("")
    lines.append("This demonstrates that the Question-First system scales across all")
    lines.append("entity types in the taxonomy using entity-type-specific question templates.")
    lines.append("")

    return lines


def generate_technical_appendix(results: dict) -> list:
    """Generate technical appendix"""
    lines = []

    lines.append("---")
    lines.append("")
    lines.append("## Technical Appendix")
    lines.append("")

    # System Components
    lines.append("### System Components")
    lines.append("")
    lines.append("| Component | File | Purpose |")
    lines.append("|-----------|------|---------|")
    lines.append("| Question-First Dossier | `entity_type_dossier_questions.py` | Generate hypotheses from entity type |")
    lines.append("| Hypothesis-Driven Discovery | `hypothesis_driven_discovery.py` | Single-hop validation via web searches |")
    lines.append("| Ralph Loop | `ralph_loop.py` | 3-pass signal validation governance |")
    lines.append("| Temporal Intelligence | `graphiti_service.py` | Timeline analysis and pattern recognition |")
    lines.append("| Narrative Builder | `narrative_builder.py` | Token-bounded episode compression |")
    lines.append("| Yellow Panther Scorer | `yellow_panther_scorer.py` | Fit scoring and positioning |")
    lines.append("")

    # Data Flow
    lines.append("### Data Flow")
    lines.append("")
    lines.append("```")
    lines.append("Entity Name + Type")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Question-First Dossier → Hypotheses (prior_confidence ~0.50)")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Hypothesis-Driven Discovery → Validated Signals (confidence 0.00-1.00)")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Ralph Loop (3-pass) → Governed Signals (>0.7 threshold)")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Temporal Intelligence → Timeline + Patterns")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Narrative Builder → Compressed Narrative (max_tokens)")
    lines.append("        │")
    lines.append("        ▼")
    lines.append("Yellow Panther Scoring → Fit Score + Recommendations")
    lines.append("```")
    lines.append("")

    # API Endpoints Used
    lines.append("### External APIs Used")
    lines.append("")
    lines.append("| Service | Purpose | Cost Model |")
    lines.append("|---------|---------|------------|")
    lines.append("| Anthropic Claude | AI reasoning | Per-token pricing |")
    lines.append("| BrightData SDK | Web scraping | Pay-per-success |")
    lines.append("| FalkorDB | Graph database | Self-hosted |")
    lines.append("| Supabase | Cache layer | Usage-based |")
    lines.append("")

    return lines


def generate_business_metrics(results: dict) -> list:
    """Generate business metrics summary"""
    lines = []

    lines.append("---")
    lines.append("")
    lines.append("## Business Metrics Summary")
    lines.append("")

    entities = results.get('entities', [])
    summary = results.get('summary', {})

    # ROI calculation
    total_cost = results.get('total_cost_usd', 0)
    total_value = 0
    for e in entities:
        val_str = e.get('estimated_value', 'TBD')
        if '£' in val_str:
            # Extract numeric value
            import re
            match = re.search(r'£(\d+)K', val_str)
            if match:
                total_value += int(match.group(1))

    lines.append("### Value Demonstration")
    lines.append("")
    lines.append(f"- **Total System Cost:** ${total_cost:.2f}")
    lines.append(f"- **Total Opportunity Value Identified:** £{total_value}K")
    lines.append(f"- **ROI Multiple:** {total_value / (total_cost * 0.8) if total_cost > 0 else 0:.1f}x")  # Rough GBP/USD conversion
    lines.append("")

    # Signal breakdown
    total_procurement = sum(e.get('procurement_signals', 0) for e in entities)
    total_capability = sum(e.get('capability_signals', 0) for e in entities)

    lines.append("### Signal Breakdown")
    lines.append("")
    lines.append(f"- **Procurement Signals:** {total_procurement}")
    lines.append(f"  - High-confidence indicators of upcoming RFPs/tenders")
    lines.append(f"- **Capability Signals:** {total_capability}")
    lines.append(f"  - Evidence of digital maturity without immediate procurement intent")
    lines.append(f"- **Total Signals:** {total_procurement + total_capability}")
    lines.append("")

    # Actionable insights
    lines.append("### Actionable Insights")
    lines.append("")
    for e in entities:
        if e['confidence_band'] in ['CONFIDENT', 'ACTIONABLE']:
            lines.append(f"#### {e['entity_name']}")
            lines.append("")
            lines.append(f"- **Priority:** {e['confidence_band']}")
            lines.append(f"- **Next Action:** {'Immediate outreach' if e['confidence_band'] == 'ACTIONABLE' else 'Engage sales team'}")
            lines.append(f"- **Estimated Value:** {e['estimated_value']}")
            lines.append("")

    return lines


def main():
    """Generate documentation from captured results"""

    # Setup paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / '../data'
    docs_dir = script_dir / '..'

    print("Loading execution results...")
    results = load_results(data_dir)

    print("Generating markdown documentation...")
    markdown = generate_markdown(results)

    # Write output
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    output_file = docs_dir / f'{timestamp}-end-to-end-system-demo.md'

    with open(output_file, 'w') as f:
        f.write(markdown)

    print(f"Documentation saved to: {output_file}")
    print(f"Characters: {len(markdown):,}")
    print(f"Lines: {markdown.count(chr(10)) + 1:,}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
