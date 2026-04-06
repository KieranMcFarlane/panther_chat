#!/usr/bin/env python3
"""
Connections Analyzer - Network Analysis for Dossier Connections Tab

Analyzes network connections between Yellow Panther team members and target entity personnel.
This module powers the "Connections" tab in the entity dossier.

FEATURES:
- Per-YP-member connection analysis (Stuart, Gunjan, Andrew, Sarfraz, Elliott)
- Mutual connection detection
- Tier 2 bridge path analysis
- Recommended introduction strategy
- Success probability scoring

INPUT DATA:
1. YP Team CSV (static) - names, roles, LinkedIn URLs
2. Target Personnel CSV - entity staff names, roles, LinkedIn URLs
3. Bridge Contacts CSV - Tier 2 network

OUTPUT:
- Primary connection analysis for each YP team member
- Tier 2 bridge paths
- Recommended approach (which YP member should lead)
- Success probabilities

AUTHOR: Phase 0 Scalable Dossier System
DATE: 2026-02-22
"""

import os
import csv
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# =============================================================================
# YELLOW PANTHER TEAM (Static Reference)
#
# Note: Gunjan Parikh is intentionally EXCLUDED from Connections analysis
# as per business requirements. The 4 active UK members for network analysis are:
# - Stuart Cope (Co-Founder & COO)
# - Andrew Rapley (Head of Projects)
# - Sarfraz Hussain (Head of Strategy)
# - Elliott Hillman (Senior Client Partner)
# =============================================================================

YELLOW_PANTHER_TEAM = [
    {
        "yp_name": "Stuart Cope",
        "yp_role": "Co-Founder & COO",
        "yp_linkedin": "https://uk.linkedin.com/in/stuart-cope-54392b16/",
        "yp_weight": 1.5,
        "yp_expertise_1": "Operations",
        "yp_expertise_2": "Client Relationships",
        "yp_expertise_3": "Strategic Partnerships"
    },
    {
        "yp_name": "Andrew Rapley",
        "yp_role": "Head of Projects",
        "yp_linkedin": "https://uk.linkedin.com/in/andrew-rapley/",
        "yp_weight": 1.3,
        "yp_expertise_1": "Project Management",
        "yp_expertise_2": "Delivery Excellence",
        "yp_expertise_3": "Client Success"
    },
    {
        "yp_name": "Sarfraz Hussain",
        "yp_role": "Head of Strategy",
        "yp_linkedin": "https://uk.linkedin.com/in/sarfraz-hussain/",
        "yp_weight": 1.2,
        "yp_expertise_1": "Strategic Planning",
        "yp_expertise_2": "Market Analysis",
        "yp_expertise_3": "Growth Strategy"
    },
    {
        "yp_name": "Elliott Hillman",
        "yp_role": "Senior Client Partner",
        "yp_linkedin": "https://uk.linkedin.com/in/elliott-hillman/",
        "yp_weight": 1.2,
        "yp_expertise_1": "Client Partnerships",
        "yp_expertise_2": "Sports Industry",
        "yp_expertise_3": "Business Development"
    }
]

# Full team including Gunjan Parikh (for reference, not used in Connections analysis)
YELLOW_PANTHER_TEAM_FULL = [
    *YELLOW_PANTHER_TEAM,
    {
        "yp_name": "Gunjan Parikh",
        "yp_role": "Founder & CEO",
        "yp_linkedin": "https://uk.linkedin.com/in/gunjan-parikh/",
        "yp_weight": 1.3,
        "yp_expertise_1": "Strategic Vision",
        "yp_expertise_2": "Business Development",
        "yp_expertise_3": "Client Strategy",
        "_excluded_from_connections": True  # Intentionally excluded from network analysis
    }
]


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class TargetPerson:
    """Target entity personnel member"""
    entity_id: str
    person_name: str
    role: str
    linkedin_url: str = ""
    mutual_connections_yp: str = ""  # YP member name if known
    count_second_degree_paths: int = 0


@dataclass
class BridgeContact:
    """Tier 2 network contact"""
    contact_name: str
    relationship_to_yp: str
    network_reach: str
    introduction_capability: str
    linkedin_url: str = ""
    target_connections_count: int = 0


@dataclass
class YPConnectionAnalysis:
    """Connection analysis for a single YP team member"""
    yp_member: Dict[str, Any]
    direct_connections: int = 0
    mutual_connections: List[str] = field(default_factory=list)
    connection_strength: str = "unknown"  # strong, medium, weak, none
    tier_2_bridges: List[str] = field(default_factory=list)
    success_probability: float = 0.0
    talking_points: List[str] = field(default_factory=list)


@dataclass
class ConnectionsResult:
    """Complete connections analysis result"""
    entity_id: str
    entity_name: str
    primary_connections: List[YPConnectionAnalysis] = field(default_factory=list)
    tier_2_bridges: List[Dict[str, Any]] = field(default_factory=list)
    recommended_approach: Dict[str, Any] = field(default_factory=dict)
    analysis_timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    overall_connection_score: float = 0.0


# =============================================================================
# CONNECTIONS ANALYZER
# =============================================================================

class ConnectionsAnalyzer:
    """
    Analyzes network connections between YP team and target entities.

    Usage:
        analyzer = ConnectionsAnalyzer()
        result = analyzer.analyze_connections(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            target_personnel=[...],
            bridge_contacts=[...]
        )
    """

    def __init__(self, yp_team: Optional[List[Dict]] = None):
        """
        Initialize connections analyzer.

        Args:
            yp_team: Optional custom YP team list (uses default if None)
        """
        self.yp_team = yp_team or YELLOW_PANTHER_TEAM
        self._load_static_data()

    def _load_static_data(self):
        """Load static data from CSV files if available"""
        self.bridge_contacts = []

        # Try loading bridge contacts from CSV
        bridge_csv_path = Path(__file__).parent.parent / "data" / "dossier_templates" / "bridge_contacts.csv"
        if bridge_csv_path.exists():
            try:
                with open(bridge_csv_path, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        if row.get('contact_name') and row.get('contact_name') != 'contact_name':
                            self.bridge_contacts.append(BridgeContact(
                                contact_name=row['contact_name'],
                                relationship_to_yp=row.get('relationship_to_yp', ''),
                                network_reach=row.get('network_reach', ''),
                                introduction_capability=row.get('introduction_capability', ''),
                                linkedin_url=row.get('linkedin_url', ''),
                                target_connections_count=int(row.get('target_connections_count', 0))
                            ))
                logger.info(f"Loaded {len(self.bridge_contacts)} bridge contacts from CSV")
            except Exception as e:
                logger.warning(f"Failed to load bridge contacts CSV: {e}")

    def analyze_connections(
        self,
        entity_id: str,
        entity_name: str,
        target_personnel: Optional[List[TargetPerson]] = None,
        bridge_contacts: Optional[List[BridgeContact]] = None,
        yp_team_data: Optional[List[Dict]] = None
    ) -> ConnectionsResult:
        """
        Analyze connections between YP team and target entity.

        Args:
            entity_id: Target entity ID (e.g., "arsenal-fc")
            entity_name: Target entity name (e.g., "Arsenal FC")
            target_personnel: List of target entity personnel (from leadership section or CSV)
            bridge_contacts: Optional bridge contacts (uses static data if None)
            yp_team_data: Optional YP team data with connection stats (from API/CSV)

        Returns:
            ConnectionsResult with analysis for all YP members
        """
        logger.info(f"Analyzing connections for {entity_name} ({entity_id})")

        target_personnel = target_personnel or []
        bridge_contacts = bridge_contacts or self.bridge_contacts
        yp_team_data = yp_team_data or []

        # Analyze each YP team member's connection potential
        primary_connections = []
        for yp_member in self.yp_team:
            analysis = self._analyze_yp_member(
                yp_member=yp_member,
                target_personnel=target_personnel,
                bridge_contacts=bridge_contacts,
                yp_team_data=yp_team_data
            )
            primary_connections.append(analysis)

        # Find recommended approach
        recommended_approach = self._determine_recommended_approach(
            primary_connections,
            target_personnel,
            bridge_contacts
        )

        # Calculate overall score
        overall_score = self._calculate_overall_score(primary_connections)

        result = ConnectionsResult(
            entity_id=entity_id,
            entity_name=entity_name,
            primary_connections=primary_connections,
            tier_2_bridges=[self._bridge_contact_to_dict(bc) for bc in bridge_contacts],
            recommended_approach=recommended_approach,
            overall_connection_score=overall_score
        )

        logger.info(f"Analysis complete: {len(primary_connections)} YP members analyzed, score: {overall_score:.1f}")

        return result

    def _analyze_yp_member(
        self,
        yp_member: Dict[str, Any],
        target_personnel: List[TargetPerson],
        bridge_contacts: List[BridgeContact],
        yp_team_data: List[Dict]
    ) -> YPConnectionAnalysis:
        """
        Analyze connection potential for a single YP team member.

        Args:
            yp_member: YP team member dict
            target_personnel: List of target entity personnel
            bridge_contacts: List of bridge contacts
            yp_team_data: YP team connection data (if available from API)

        Returns:
            YPConnectionAnalysis for this YP member
        """
        yp_name = yp_member["yp_name"]

        analysis = YPConnectionAnalysis(
            yp_member=yp_member,
            direct_connections=0,
            mutual_connections=[],
            connection_strength="unknown",
            tier_2_bridges=[],
            success_probability=0.0,
            talking_points=[]
        )

        # Check for direct connections in yp_team_data
        if yp_team_data:
            for data in yp_team_data:
                if data.get("yp_name") == yp_name:
                    analysis.direct_connections = data.get("direct_connections", 0)
                    analysis.mutual_connections = data.get("mutual_connections", [])
                    analysis.success_probability = data.get("success_probability", 0.0)
                    break

        # Check target personnel for mutual connections
        for person in target_personnel:
            if person.mutual_connections_yp == yp_name:
                if person.person_name not in analysis.mutual_connections:
                    analysis.mutual_connections.append(person.person_name)
                analysis.direct_connections += person.count_second_degree_paths

        # Determine connection strength
        if analysis.direct_connections >= 3 or len(analysis.mutual_connections) >= 2:
            analysis.connection_strength = "strong"
            analysis.success_probability = max(analysis.success_probability, 70.0)
        elif analysis.direct_connections >= 1 or len(analysis.mutual_connections) >= 1:
            analysis.connection_strength = "medium"
            analysis.success_probability = max(analysis.success_probability, 40.0)
        elif analysis.direct_connections == 0 and len(analysis.mutual_connections) == 0:
            analysis.connection_strength = "none"
            analysis.success_probability = 10.0  # Base cold probability

        # Find relevant bridge contacts
        for bridge in bridge_contacts:
            if yp_name in bridge.relationship_to_yp:
                analysis.tier_2_bridges.append(bridge.contact_name)
                # Boost success probability if bridge contact available
                if analysis.connection_strength == "none":
                    analysis.success_probability = max(analysis.success_probability, 25.0)

        # Generate talking points based on YP expertise
        yp_role = yp_member.get("yp_role", "")
        if "COO" in yp_role or "Operations" in yp_role:
            analysis.talking_points = [
                "Operational excellence in project delivery",
                "Proven track record with sports organizations",
                "Efficient implementation methodologies"
            ]
        elif "CEO" in yp_role or "Founder" in yp_role:
            analysis.talking_points = [
                "Strategic vision for digital transformation",
                "Executive-level partnership experience",
                "Long-term value creation focus"
            ]
        elif "Projects" in yp_role:
            analysis.talking_points = [
                "On-time, on-budget delivery track record",
                "Complex project management expertise",
                "Stakeholder coordination excellence"
            ]
        elif "Strategy" in yp_role:
            analysis.talking_points = [
                "Market analysis and competitive positioning",
                "Growth strategy development",
                "Data-driven decision making"
            ]
        elif "Client" in yp_role or "Partnerships" in yp_role:
            analysis.talking_points = [
                "Client success focus",
                "Sports industry expertise",
                "Relationship-building capabilities"
            ]

        # Apply weight to success probability
        yp_weight = yp_member.get("yp_weight", 1.0)
        analysis.success_probability = min(100.0, analysis.success_probability * yp_weight)

        return analysis

    def _determine_recommended_approach(
        self,
        primary_connections: List[YPConnectionAnalysis],
        target_personnel: List[TargetPerson],
        bridge_contacts: List[BridgeContact]
    ) -> Dict[str, Any]:
        """
        Determine the recommended introduction approach.

        Args:
            primary_connections: Connection analysis for each YP member
            target_personnel: Target entity personnel
            bridge_contacts: Available bridge contacts

        Returns:
            Dict with recommended approach details
        """
        # Find YP member with highest success probability
        best_connection = max(
            primary_connections,
            key=lambda c: c.success_probability,
            default=None
        )

        if not best_connection:
            return {
                "yp_member": "Unknown",
                "introduction_path": "Cold",
                "mutual_connections": [],
                "talking_points": [],
                "success_probability": 10.0,
                "rationale": "No connection data available - cold approach required"
            }

        yp_name = best_connection.yp_member["yp_name"]
        yp_role = best_connection.yp_member["yp_role"]

        # Determine path type
        if best_connection.connection_strength == "strong":
            path_type = "Direct (warm)"
        elif best_connection.connection_strength == "medium":
            path_type = "Direct (lukewarm)"
        elif best_connection.tier_2_bridges:
            path_type = "Tier 2 bridge"
        else:
            path_type = "Cold"

        return {
            "yp_member": yp_name,
            "yp_role": yp_role,
            "introduction_path": path_type,
            "mutual_connections": best_connection.mutual_connections,
            "talking_points": best_connection.talking_points,
            "success_probability": round(best_connection.success_probability, 1),
            "rationale": f"{yp_name} has {best_connection.connection_strength} connections "
                       f"({best_connection.direct_connections} direct, "
                       f"{len(best_connection.mutual_connections)} mutual)"
        }

    def _calculate_overall_score(self, primary_connections: List[YPConnectionAnalysis]) -> float:
        """
        Calculate overall connection strength score.

        Args:
            primary_connections: Connection analysis for all YP members

        Returns:
            Overall score 0-100
        """
        if not primary_connections:
            return 0.0

        # Average success probability across all YP members
        avg_probability = sum(c.success_probability for c in primary_connections) / len(primary_connections)

        # Bonus for having multiple members with connections
        connection_count = sum(1 for c in primary_connections if c.connection_strength in ["strong", "medium"])

        return min(100.0, avg_probability + (connection_count * 5))

    def _bridge_contact_to_dict(self, bridge: BridgeContact) -> Dict[str, Any]:
        """Convert BridgeContact to dict"""
        return {
            "contact_name": bridge.contact_name,
            "relationship_to_yp": bridge.relationship_to_yp,
            "network_reach": bridge.network_reach,
            "introduction_capability": bridge.introduction_capability,
            "linkedin_url": bridge.linkedin_url,
            "target_connections_count": bridge.target_connections_count
        }


def _target_personnel_from_poi_graph(
    *,
    entity_id: str,
    poi_graph: Optional[Dict[str, Any]] = None,
) -> List[TargetPerson]:
    """Convert a question-first poi_graph payload into TargetPerson records.

    This is a structural adapter only. The current poi_graph_v1 contains entity->person
    edges but not YP-to-target connection edges, so mutual/direct connection fields
    stay empty until a later graph enrichment pass adds them.
    """
    graph = poi_graph if isinstance(poi_graph, dict) else {}
    nodes = graph.get("nodes") if isinstance(graph.get("nodes"), list) else []
    edges = graph.get("edges") if isinstance(graph.get("edges"), list) else []

    person_nodes: Dict[str, Dict[str, Any]] = {}
    for node in nodes:
        if not isinstance(node, dict):
            continue
        if str(node.get("node_type") or "").strip().lower() != "person":
            continue
        node_id = str(node.get("node_id") or "").strip()
        if node_id:
            person_nodes[node_id] = node

    target_personnel: List[TargetPerson] = []
    seen_people = set()
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        to_id = str(edge.get("to_id") or "").strip()
        person = person_nodes.get(to_id)
        if not person:
            continue
        person_name = str(person.get("name") or "").strip()
        if not person_name:
            continue
        dedupe_key = person_name.lower()
        if dedupe_key in seen_people:
            continue
        seen_people.add(dedupe_key)
        target_personnel.append(
            TargetPerson(
                entity_id=entity_id,
                person_name=person_name,
                role=str(person.get("title") or "").strip(),
                linkedin_url=str(person.get("linkedin_url") or "").strip(),
                mutual_connections_yp="",
                count_second_degree_paths=0,
            )
        )

    return target_personnel


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def analyze_connections_from_csv(
    entity_id: str,
    entity_name: str,
    target_personnel_csv: Optional[str] = None,
    yp_team_csv: Optional[str] = None
) -> ConnectionsResult:
    """
    Analyze connections from CSV files.

    Args:
        entity_id: Target entity ID
        entity_name: Target entity name
        target_personnel_csv: Path to target_personnel CSV file
        yp_team_csv: Path to yp_team CSV file (optional)

    Returns:
        ConnectionsResult with analysis
    """
    analyzer = ConnectionsAnalyzer()

    # Load YP team from CSV if provided
    yp_team = None
    if yp_team_csv and Path(yp_team_csv).exists():
        yp_team = []
        with open(yp_team_csv, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('yp_name') and row.get('yp_name') != 'yp_name':
                    yp_team.append({
                        "yp_name": row['yp_name'],
                        "yp_role": row.get('yp_role', ''),
                        "yp_linkedin": row.get('yp_linkedin', ''),
                        "yp_weight": float(row.get('yp_weight', 1.0)),
                        "yp_expertise_1": row.get('yp_expertise_1', ''),
                        "yp_expertise_2": row.get('yp_expertise_2', ''),
                        "yp_expertise_3": row.get('yp_expertise_3', '')
                    })
        analyzer = ConnectionsAnalyzer(yp_team=yp_team)

    # Load target personnel from CSV if provided
    target_personnel = []
    if target_personnel_csv and Path(target_personnel_csv).exists():
        with open(target_personnel_csv, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('entity_id') == entity_id:
                    target_personnel.append(TargetPerson(
                        entity_id=row['entity_id'],
                        person_name=row['person_name'],
                        role=row['role'],
                        linkedin_url=row.get('linkedin_url', ''),
                        mutual_connections_yp=row.get('mutual_connections_yp', ''),
                        count_second_degree_paths=int(row.get('count_second_degree_paths', 0))
                    ))

    return analyzer.analyze_connections(
        entity_id=entity_id,
        entity_name=entity_name,
        target_personnel=target_personnel
    )


def analyze_connections_from_question_first_dossier(
    question_first_dossier_path: str,
    yp_team_csv: Optional[str] = None,
) -> ConnectionsResult:
    """
    Analyze connections using target personnel derived from a question-first dossier.

    Args:
        question_first_dossier_path: Path to `*_question_first_dossier.json`
        yp_team_csv: Optional path to yp_team CSV file

    Returns:
        ConnectionsResult with analysis
    """
    dossier_path = Path(question_first_dossier_path)
    payload = json.loads(dossier_path.read_text(encoding="utf-8"))
    merged_dossier = payload.get("merged_dossier") if isinstance(payload.get("merged_dossier"), dict) else payload

    entity_id = str(
        payload.get("entity_id")
        or merged_dossier.get("entity_id")
        or merged_dossier.get("metadata", {}).get("entity_id")
        or ""
    ).strip()
    entity_name = str(
        payload.get("entity_name")
        or merged_dossier.get("entity_name")
        or merged_dossier.get("metadata", {}).get("entity_name")
        or entity_id
    ).strip()

    question_first = merged_dossier.get("question_first") if isinstance(merged_dossier.get("question_first"), dict) else {}
    question_first_run = merged_dossier.get("question_first_run") if isinstance(merged_dossier.get("question_first_run"), dict) else {}
    poi_graph = (
        question_first.get("poi_graph")
        if isinstance(question_first.get("poi_graph"), dict)
        else question_first_run.get("poi_graph")
        if isinstance(question_first_run.get("poi_graph"), dict)
        else {}
    )

    analyzer = ConnectionsAnalyzer()
    if yp_team_csv and Path(yp_team_csv).exists():
        yp_team = []
        with open(yp_team_csv, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('yp_name') and row.get('yp_name') != 'yp_name':
                    yp_team.append({
                        "yp_name": row['yp_name'],
                        "yp_role": row.get('yp_role', ''),
                        "yp_linkedin": row.get('yp_linkedin', ''),
                        "yp_weight": float(row.get('yp_weight', 1.0)),
                        "yp_expertise_1": row.get('yp_expertise_1', ''),
                        "yp_expertise_2": row.get('yp_expertise_2', ''),
                        "yp_expertise_3": row.get('yp_expertise_3', '')
                    })
        analyzer = ConnectionsAnalyzer(yp_team=yp_team)

    target_personnel = _target_personnel_from_poi_graph(entity_id=entity_id, poi_graph=poi_graph)
    return analyzer.analyze_connections(
        entity_id=entity_id,
        entity_name=entity_name,
        target_personnel=target_personnel,
    )


def format_connections_for_dossier(result: ConnectionsResult) -> Dict[str, Any]:
    """
    Format ConnectionsResult as a dict suitable for dossier output.

    Args:
        result: ConnectionsResult from analyzer

    Returns:
        Dict formatted for dossier JSON structure
    """
    # Build content array
    content_lines = [
        "[Primary Connection Analysis]",
        ""
    ]

    for conn in result.primary_connections:
        yp_name = conn.yp_member["yp_name"]
        content_lines.append(f"[{yp_name}]:")
        content_lines.append(f"- Direct Connections: {conn.direct_connections or 'none detected'}")
        if conn.mutual_connections:
            content_lines.append(f"- Mutual Connections: {', '.join(conn.mutual_connections)}")
        else:
            content_lines.append(f"- Mutual Connections: none detected")
        content_lines.append(f"- Connection Strength: {conn.connection_strength}")
        content_lines.append("")

    if result.tier_2_bridges:
        content_lines.append("[Tier 2 Bridge Paths]")
        for bridge in result.tier_2_bridges:
            content_lines.append(f"- {bridge['contact_name']}: {bridge['introduction_capability']}")
        content_lines.append("")

    content_lines.append(f"[Recommended Approach]: {result.recommended_approach.get('yp_member', 'Unknown')} should lead")

    # Build metrics
    metrics = [{
        "label": "Connection Strength",
        "value": round(result.overall_connection_score, 0),
        "meaning": f"Overall connection quality to {result.entity_name}",
        "why": f"Based on {sum(1 for c in result.primary_connections if c.connection_strength in ['strong', 'medium'])} YP team members with connections",
        "benchmark": "vs other targets",
        "action": f"Approach via {result.recommended_approach.get('yp_member', 'Unknown')} for best results"
    }]

    # Build insights
    insights = []
    for conn in result.primary_connections:
        if conn.connection_strength in ["strong", "medium"]:
            insights.append({
                "insight": f"{conn.yp_member['yp_name']} has {conn.connection_strength} connection potential",
                "signal_type": "[CONTACT]",
                "confidence": round(conn.success_probability, 0)
            })

    # Build recommendations
    recommendations = [{
        "yp_member": result.recommended_approach.get("yp_member"),
        "introduction_path": result.recommended_approach.get("introduction_path"),
        "mutual_connections": result.recommended_approach.get("mutual_connections", []),
        "talking_points": result.recommended_approach.get("talking_points", []),
        "success_probability": result.recommended_approach.get("success_probability", 0),
        "rationale": result.recommended_approach.get("rationale", "")
    }]

    return {
        "content": content_lines,
        "metrics": metrics,
        "insights": insights,
        "recommendations": recommendations
    }


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    """CLI interface for connections analysis"""
    import argparse

    parser = argparse.ArgumentParser(description="Analyze network connections")
    parser.add_argument("--entity-id", required=True, help="Entity ID (e.g., arsenal-fc)")
    parser.add_argument("--entity-name", required=True, help="Entity name (e.g., Arsenal FC)")
    parser.add_argument("--target-csv", help="Path to target_personnel.csv")
    parser.add_argument("--question-first-dossier", help="Path to *_question_first_dossier.json")
    parser.add_argument("--output", help="Output JSON file path")
    parser.add_argument("--verbose", action="store_true", help="Verbose logging")

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.INFO)

    # Run analysis
    if args.question_first_dossier:
        result = analyze_connections_from_question_first_dossier(
            question_first_dossier_path=args.question_first_dossier,
        )
    else:
        result = analyze_connections_from_csv(
            entity_id=args.entity_id,
            entity_name=args.entity_name,
            target_personnel_csv=args.target_csv
        )

    # Format output
    output = format_connections_for_dossier(result)

    # Add metadata
    output["metadata"] = {
        "entity_id": result.entity_id,
        "entity_name": result.entity_name,
        "analysis_timestamp": result.analysis_timestamp,
        "overall_connection_score": result.overall_connection_score,
        "yp_members_analyzed": len(result.primary_connections)
    }

    # Print or save
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"Output saved to {args.output}")
    else:
        print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
