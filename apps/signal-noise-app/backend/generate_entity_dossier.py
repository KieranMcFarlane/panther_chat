#!/usr/bin/env python3
"""
Entity Dossier Generator - Compile discovery findings into structured intelligence dossier

Usage:
    from backend.generate_entity_dossier import generate_dossier

    dossier = await generate_dossier(
        entity=entity,
        validated_signals=validated_signals,
        final_confidence=0.81,
        discovery_results=discovery_results
    )
    # Returns: Complete structured dossier with all sections
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class DossierSection:
    """Single section of the dossier"""
    id: str
    title: str
    content: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content
        }


@dataclass
class EntityDossier:
    """Complete intelligence dossier"""
    entity_id: str
    entity_name: str
    entity_type: str
    priority_score: int
    tier: str
    final_confidence: float
    confidence_band: str
    is_actionable: bool
    sections: List[DossierSection] = field(default_factory=list)

    def add_section(self, section: DossierSection):
        """Add a section to the dossier"""
        self.sections.append(section)

    def to_dict(self) -> Dict[str, Any]:
        """Convert dossier to dictionary"""
        return {
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'entity_type': self.entity_type,
            'priority_score': self.priority_score,
            'tier': self.tier,
            'final_confidence': self.final_confidence,
            'confidence_band': self.confidence_band,
            'is_actionable': self.is_actionable,
            'sections': [section.to_dict() for section in self.sections]
        }


def calculate_confidence_band(confidence: float) -> str:
    """Calculate confidence band from score"""
    if confidence < 0.30:
        return "EXPLORATORY"
    elif confidence < 0.60:
        return "INFORMED"
    elif confidence < 0.80:
        return "CONFIDENT"
    else:
        return "ACTIONABLE"


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


async def generate_dossier(
    entity,
    validated_signals: List[Dict[str, Any]],
    final_confidence: float,
    discovery_results: Optional[Dict[str, Any]] = None
) -> EntityDossier:
    """
    Generate complete entity dossier from discovery results

    Args:
        entity: Entity object with id, name, type, metadata, priority_tier
        validated_signals: List of validated signals from Ralph Loop
        final_confidence: Final confidence score (0.0-1.0)
        discovery_results: Optional discovery metadata (iterations, costs, etc.)

    Returns:
        EntityDossier with all sections populated
    """

    logger.info(f"Generating dossier for {entity.name}")

    # Calculate metadata
    priority_score = entity.metadata.get('priority', 50)
    confidence_band = calculate_confidence_band(final_confidence)

    # Check actionable gate (≥2 ACCEPTs across ≥2 categories)
    accept_count = sum(1 for s in validated_signals if s.get('decision') == 'ACCEPT')
    unique_categories = len(set(s.get('category', 'unknown') for s in validated_signals if s.get('decision') == 'ACCEPT')
    is_actionable = final_confidence > 0.80 and accept_count >= 2 and unique_categories >= 2

    # Create dossier object
    dossier = EntityDossier(
        entity_id=entity.id,
        entity_name=entity.name,
        entity_type=entity.type,
        priority_score=priority_score,
        tier=entity.priority_tier or 'STANDARD',
        final_confidence=final_confidence,
        confidence_band=confidence_band,
        is_actionable=is_actionable
    )

    # Organize signals by section/category
    signals_by_category: Dict[str, List[Dict[str, Any]]] = {}
    for signal in validated_signals:
        category = signal.get('category', 'general')
        if category not in signals_by_category:
            signals_by_category[category] = []
        signals_by_category[category].append(signal)

    # Section 1: Leadership Profile
    if 'leadership' in signals_by_category:
        dossier.add_section(DossierSection(
            id='leadership_profile',
            title='Leadership Profile',
            content=_build_leadership_section(signals_by_category['leadership'])
        )

    # Section 2: Technology Stack
    if 'technology' in signals_by_category:
        dossier.add_section(DossierSection(
            id='technology_profile',
            title='Technology Stack',
            content=_build_technology_section(signals_by_category['technology'])
        )

    # Section 3: Procurement Strategy
    if 'procurement' in signals_by_category:
        dossier.add_section(DossierSection(
            id='procurement_profile',
            title='Procurement Strategy',
            content=_build_procurement_section(signals_by_category['procurement'])
        )

    # Section 4: Partnership Profile
    if 'partnerships' in signals_by_category:
        dossier.add_section(DossierSection(
            id='partnership_profile',
            title='Partnership Profile',
            content=_build_partnership_section(signals_by_category['partnerships'])
        )

    # Section 5: Budget & Resources
    if 'budget' in signals_by_category:
        dossier.add_section(DossierSection(
            id='budget_profile',
            title='Budget & Resources',
            content=_build_budget_section(signals_by_category['budget'])
        )

    # Section 6: Digital Maturity Profile
    if 'digital_transformation' in signals_by_category:
        dossier.add_section(DossierSection(
            id='digital_maturity_profile',
            title='Digital Maturity Profile',
            content=_build_digital_maturity_section(signals_by_category['digital_transformation'])
        )

    # Section 7: Opportunities & Signals
    if 'opportunities' in signals_by_category:
        dossier.add_section(DossierSection(
            id='opportunities_profile',
            title='Opportunities & Signals',
            content=_build_opportunities_section(signals_by_category['opportunities'])
        )

    # Section 8: Timeline & History
    if 'timeline' in signals_by_category:
        dossier.add_section(DossierSection(
            id='timeline_history',
            title='Timeline & History',
            content=_build_timeline_section(signals_by_category['timeline'])
        )

    # Section 9: Executive Changes
    if 'executive_changes' in signals_by_category:
        dossier.add_section(DossierSection(
            id='executive_changes',
            title='Executive Changes',
            content=_build_executive_section(signals_by_category['executive_changes'])
        )

    # Section 10: Governance & Strategy
    if 'governance' in signals_by_category:
        dossier.add_section(DossierSection(
            id='governance_strategy',
            title='Governance & Strategy',
            content=_build_governance_section(signals_by_category['governance'])
        )

    # Section 11: Confidence Assessment (always include)
    dossier.add_section(DossierSection(
        id='confidence_assessment',
        title='Confidence Assessment',
        content=_build_confidence_section(
            final_confidence=final_confidence,
            confidence_band=confidence_band,
            accept_count=accept_count,
            unique_categories=unique_categories,
            is_actionable=is_actionable,
            total_signals=len(validated_signals)
        ))

    logger.info(f"✅ Generated dossier with {len(dossier.sections)} sections")
    return dossier


def _build_leadership_section(signals: List[Dict]) -> List[Dict]:
    """Build leadership profile section from signals"""
    content = []

    # Group by type
    decision_makers = []
    executives = []

    for signal in signals:
        if signal.get('signal_type') == 'EXECUTIVE_APPOINTMENT':
            decision_makers.append({
                'name': signal.get('title'),
                'role': signal.get('metadata', {}).get('role'),
                'club': signal.get('entity_name'),
                'priority': signal.get('metadata', {}).get('priority'),
                'confidence': signal.get('confidence')
            })
        elif signal.get('signal_type') == 'EXECUTIVE_CHANGE':
            executives.append({
                'name': signal.get('title'),
                'club': signal.get('entity_name'),
                'bio': signal.get('description'),
                'confidence': signal.get('confidence')
            })

    if decision_makers or executives:
        content.append({
            'heading': 'Decision Makers',
            'details': decision_makers
        })
        content.append({
            'heading': 'Executive Bios',
            'details': executives
        })

    return content


def _build_technology_section(signals: List[Dict]) -> List[Dict]:
    """Build technology stack section from signals"""
    content = []

    # Group by category
    digital_platforms = []
    analytics_data = []
    crm_systems = []

    for signal in signals:
        metadata = signal.get('metadata', {})
        category = metadata.get('technology_category')

        platform_info = {
            'name': signal.get('title'),
            'status': metadata.get('status'),
            'confidence': signal.get('confidence')
        }

        if category == 'Digital Platform':
            digital_platforms.append(platform_info)
        elif category == 'Analytics & Data':
            analytics_data.append(platform_info)
        elif category == 'CRM System':
            crm_systems.append(platform_info)

    if digital_platforms:
        content.append({
            'category': 'Digital Platforms',
            'platforms': digital_platforms
        })
    if analytics_data:
        content.append({
            'category': 'Analytics & Data',
            'platforms': analytics_data
        })
    if crm_systems:
        content.append({
            'category': 'CRM Systems',
            'platforms': crm_systems
        })

    return content


def _build_procurement_section(signals: List[Dict]) -> List[Dict]:
    """Build procurement strategy section from signals"""
    content = []

    for signal in signals:
        metadata = signal.get('metadata', {})

        if signal.get('signal_type') == 'BUDGET_CYCLE':
            content.append({
                'budget_cycle': metadata.get('cycle'),
                'spending_power': metadata.get('spending_power'),
                'confidence': signal.get('confidence')
            })
        elif signal.get('signal_type') == 'ACTIVE_TENDER':
            content.append({
                'active_tenders': [{
                    'name': signal.get('title'),
                    'type': metadata.get('tender_type'),
                    'confidence': signal.get('confidence')
                }]
            })
        elif signal.get('signal_type') == 'VENDOR_RELATIONSHIP':
            content.append({
                'vendor_relationships': [{
                    'name': signal.get('title'),
                    'type': metadata.get('relationship_type'),
                    'status': metadata.get('status'),
                    'confidence': signal.get('confidence')
                }]
            })

    return content


def _build_partnership_section(signals: List[Dict]) -> List[Dict]:
    """Build partnership profile section from signals"""
    content = []

    technology_partners = []
    active_contracts = []

    for signal in signals:
        metadata = signal.get('metadata', {})

        if signal.get('signal_type') == 'TECHNOLOGY_PARTNERSHIP':
            technology_partners.append({
                'name': signal.get('title'),
                'type': metadata.get('partner_type'),
                'confidence': signal.get('confidence')
            })
        elif signal.get('signal_type') == 'ACTIVE_CONTRACT':
            active_contracts.append({
                'name': signal.get('title'),
                'type': metadata.get('contract_type'),
                'confidence': signal.get('confidence')
            })

    if technology_partners:
        content.append({
            'technology_partners': technology_partners
        })
    if active_contracts:
        content.append({
            'active_contracts': active_contracts
        })

    return content


def _build_budget_section(signals: List[Dict]) -> List[Dict]:
    """Build budget & resources section from signals"""
    content = []

    for signal in signals:
        metadata = signal.get('metadata', {})
        content.append({
            'heading': 'Financial Overview',
            'details': [{
                'metric': signal.get('title').lower().replace(' ', '_'),
                'value': metadata.get('value'),
                'confidence': signal.get('confidence')
            }]
        })

    return content


def _build_digital_maturity_section(signals: List[Dict]) -> List[Dict]:
    """Build digital maturity profile section from signals"""
    content = []

    transformation_roadmap = []
    cloud_adoption = []

    for signal in signals:
        metadata = signal.get('metadata', {})

        if signal.get('signal_type') == 'TRANSFORMATION_PHASE':
            transformation_roadmap.append({
                'phase': signal.get('title'),
                'confidence': signal.get('confidence')
            })
        elif signal.get('signal_type') == 'CLOUD_PLATFORM':
            cloud_adoption.append({
                'name': signal.get('title'),
                'status': metadata.get('status'),
                'confidence': signal.get('confidence')
            })

    if transformation_roadmap:
        content.append({
            'transformation_roadmap': transformation_roadmap
        })
    if cloud_adoption:
        content.append({
            'cloud_adoption': cloud_adoption
        })

    return content


def _build_opportunities_section(signals: List[Dict]) -> List[Dict]:
    """Build opportunities & signals section from signals"""
    content = []

    active_rfps = []
    active_tenders = []
    technology_partnerships = []

    for signal in signals:
        metadata = signal.get('metadata', {})

        if signal.get('signal_type') == 'RFP_DETECTED':
            active_rfps.append({
                'name': signal.get('title'),
                'type': metadata.get('rfp_type'),
                'confidence': signal.get('confidence'),
                'source': metadata.get('source_url')
            })
        elif signal.get('signal_type') == 'SOLICITATION_TENDER':
            active_tenders.append({
                'name': signal.get('title'),
                'type': metadata.get('tender_type'),
                'confidence': signal.get('confidence')
            })
        elif signal.get('signal_type') == 'TECHNOLOGY_PARTNERSHIP':
            technology_partnerships.append({
                'name': signal.get('title'),
                'type': metadata.get('rfp_type'),
                'confidence': signal.get('confidence')
            })

    if active_rfps:
        content.append({
            'active_rfps': active_rfps
        })
    if active_tenders:
        content.append({
            'active_tenders': active_tenders
        })
    if technology_partnerships:
        content.append({
            'technology_partnerships': technology_partnerships
        })

    return content


def _build_timeline_section(signals: List[Dict]) -> List[Dict]:
    """Build timeline & history section from signals"""
    content = []

    recent_deployments = []
    major_initiatives = []

    for signal in signals:
        metadata = signal.get('metadata', {})

        if signal.get('signal_type') == 'RECENT_DEPLOYMENT':
            recent_deployments.append({
                'name': signal.get('title'),
                'type': metadata.get('deployment_type'),
                'date': metadata.get('date'),
                'confidence': signal.get('confidence')
            })
        elif signal.get('signal_type') == 'MAJOR_INITIATIVE':
            major_initiatives.append({
                'name': signal.get('title'),
                'type': metadata.get('initiative_type'),
                'date': metadata.get('date'),
                'confidence': signal.get('confidence')
            })

    if recent_deployments:
        content.append({
            'recent_deployments': recent_deployments
        })
    if major_initiatives:
        content.append({
            'major_initiatives': major_initiatives
        })

    return content


def _build_executive_section(signals: List[Dict]) -> List[Dict]:
    """Build executive changes section from signals"""
    content = []

    for signal in signals:
        metadata = signal.get('metadata', {})
        content.append({
            'heading': 'Recent Appointments',
            'details': [{
                'name': signal.get('title'),
                'role': metadata.get('role'),
                'type': metadata.get('appoint_type'),
                'confidence': signal.get('confidence')
            }]
        })

    return content


def _build_governance_section(signals: List[Dict]) -> List[Dict]:
    """Build governance & strategy section from signals"""
    content = []

    for signal in signals:
        metadata = signal.get('metadata', {})
        content.append({
            'strategic_initiatives': [{
                'name': signal.get('title'),
                'status': metadata.get('status'),
                'confidence': signal.get('confidence')
            }]
        })

    return content


def _build_confidence_section(
    final_confidence: float,
    confidence_band: str,
    accept_count: int,
    unique_categories: int,
    is_actionable: bool,
    total_signals: int
) -> List[Dict]:
    """Build confidence assessment section"""
    return [{
        'heading': 'Overall Confidence Score',
        'details': [{
            'score': final_confidence,
            'band': confidence_band,
            'accept_count': accept_count,
            'unique_categories': unique_categories,
            'is_actionable': is_actionable,
            'total_signals': total_signals,
            'justification': _generate_justification(final_confidence, accept_count, unique_categories)
        }]
    }]


def _generate_justification(confidence: float, accept_count: int, unique_categories: int) -> str:
    """Generate justification text for confidence score"""
    if confidence >= 0.80:
        return "Very strong procurement signals across multiple categories with high confidence scores"
    elif confidence >= 0.60:
        return f"Strong procurement signals across technology and partnerships with {accept_count} ACCEPTs across {unique_categories} categories"
    elif confidence >= 0.30:
        return f"Moderate confidence with some capability signals detected ({accept_count} total ACCEPTs)"
    else:
        return "Low confidence, limited evidence of procurement intent"
