"""
MCP Tools for Graph Intelligence System

Exposes MVP pipeline operations as Model Context Protocol tools
for integration with CopilotKit and other AI agents.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Import MVP components
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from integration.mvp_pipeline import MVPPipeline
from integration.graph_memory import get_graph_memory

# Global pipeline instance (lazy initialization)
_pipeline: Optional[MVPPipeline] = None


def get_pipeline() -> MVPPipeline:
    """Get or create pipeline instance"""
    global _pipeline
    if _pipeline is None:
        _pipeline = MVPPipeline()
    return _pipeline


async def query_entity(
    entity_id: str,
    include_timeline: bool = False,
    timeline_days: int = 30
) -> Dict[str, Any]:
    """
    Query an entity from the knowledge graph

    Args:
        entity_id: Entity identifier (e.g., "ac_milan", "manchester_united")
        include_timeline: Whether to include signal timeline
        timeline_days: Days to look back for timeline (default: 30)

    Returns:
        Entity data with optional timeline
    """
    pipeline = get_pipeline()

    # Get entity data
    entity_data = await pipeline.query_entity(entity_id, include_signals=True)

    # Add timeline if requested
    if include_timeline and entity_data.get('found'):
        timeline = await pipeline.query_timeline(entity_id, days=timeline_days)
        entity_data['timeline'] = timeline['timeline']
        entity_data['timeline_days'] = timeline_days

    return entity_data


async def search_entities(
    query: str,
    entity_type: Optional[str] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Search for entities in the knowledge graph

    Args:
        query: Search query string
        entity_type: Optional entity type filter (ORG, PERSON, etc.)
        limit: Maximum results to return

    Returns:
        List of matching entities
    """
    pipeline = get_pipeline()
    results = await pipeline.search_entities(query, entity_type)

    return results[:limit]


async def get_entity_signals(
    entity_id: str,
    signal_types: Optional[List[str]] = None,
    days: int = 30,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Get signals for an entity

    Args:
        entity_id: Entity identifier
        signal_types: Optional filter by signal types
        days: Days to look back (default: 30)
        limit: Maximum signals to return

    Returns:
        List of signals
    """
    graph = get_graph_memory()
    signals = await graph.get_entity_signals(
        entity_id=entity_id,
        signal_types=signal_types,
        limit=limit
    )

    # Filter by date
    cutoff = datetime.now() - timedelta(days=days)
    recent = [
        s for s in signals
        if s.created_at >= cutoff
    ]

    return [s.to_dict() for s in recent[:limit]]


async def run_intelligence_batch(
    batch_size: int = 5
) -> Dict[str, Any]:
    """
    Run a batch through the intelligence pipeline

    This processes entities through:
    1. Entity Scheduler (prioritization)
    2. Signal Extraction (3 signal types)
    3. Validation (confidence ≥ 0.6)
    4. Graph Storage

    Args:
        batch_size: Number of entities to process

    Returns:
        Pipeline results with statistics
    """
    pipeline = get_pipeline()
    result = await pipeline.run_batch(batch_size=batch_size)

    return {
        'entities_processed': result.entities_processed,
        'signals_extracted': result.signals_extracted,
        'signals_validated': result.signals_validated,
        'signals_added_to_graph': result.signals_added_to_graph,
        'duration_seconds': result.duration_seconds,
        'errors': result.errors
    }


async def get_system_stats() -> Dict[str, Any]:
    """
    Get system statistics

    Returns:
        System statistics including entities, signals, and configuration
    """
    pipeline = get_pipeline()
    stats = await pipeline.get_statistics()

    return stats


async def list_signal_types() -> List[str]:
    """
    List available signal types

    Returns:
        List of canonical signal types
    """
    from signals.signal_extractor import get_canonical_signal_types
    return get_canonical_signal_types()


# Tool definitions for MCP
MCP_TOOLS = {
    'query_entity': {
        'name': 'query_entity',
        'description': 'Query an entity from the knowledge graph to get its details and signals',
        'parameters': {
            'entity_id': {
                'type': 'string',
                'description': 'Entity identifier (e.g., "ac_milan", "manchester_united")',
                'required': True
            },
            'include_timeline': {
                'type': 'boolean',
                'description': 'Whether to include signal timeline',
                'required': False
            },
            'timeline_days': {
                'type': 'integer',
                'description': 'Days to look back for timeline (default: 30)',
                'required': False
            }
        }
    },

    'search_entities': {
        'name': 'search_entities',
        'description': 'Search for entities in the knowledge graph by name or metadata',
        'parameters': {
            'query': {
                'type': 'string',
                'description': 'Search query string',
                'required': True
            },
            'entity_type': {
                'type': 'string',
                'description': 'Optional entity type filter (ORG, PERSON, etc.)',
                'required': False
            },
            'limit': {
                'type': 'integer',
                'description': 'Maximum results to return (default: 10)',
                'required': False
            }
        }
    },

    'get_entity_signals': {
        'name': 'get_entity_signals',
        'description': 'Get all signals for a specific entity with optional filtering',
        'parameters': {
            'entity_id': {
                'type': 'string',
                'description': 'Entity identifier',
                'required': True
            },
            'signal_types': {
                'type': 'array',
                'description': 'Optional list of signal types to filter by',
                'required': False
            },
            'days': {
                'type': 'integer',
                'description': 'Days to look back (default: 30)',
                'required': False
            },
            'limit': {
                'type': 'integer',
                'description': 'Maximum signals to return (default: 20)',
                'required': False
            }
        }
    },

    'run_intelligence_batch': {
        'name': 'run_intelligence_batch',
        'description': 'Run the intelligence pipeline to process entities and extract signals',
        'parameters': {
            'batch_size': {
                'type': 'integer',
                'description': 'Number of entities to process (default: 5)',
                'required': False
            }
        }
    },

    'get_system_stats': {
        'name': 'get_system_stats',
        'description': 'Get system statistics including total entities and signals',
        'parameters': {}
    },

    'list_signal_types': {
        'name': 'list_signal_types',
        'description': 'List all available signal types in the system',
        'parameters': {}
    }
}
