#!/usr/bin/env python3
"""
Narrative Builder for Temporal Episodes

Converts raw episode data into human-readable narratives for Claude.
Provides token-bounded compression of temporal information.

Usage:
    from backend.narrative_builder import build_narrative_from_episodes

    narrative = build_narrative_from_episodes(episodes, max_tokens=2000)
"""

import logging
from typing import List, Dict, Any
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)


def estimate_tokens(text: str) -> int:
    """
    Rough token estimation (~4 chars per token)

    Args:
        text: Text to estimate

    Returns:
        Estimated token count
    """
    return len(text) // 4


def build_narrative_from_episodes(
    episodes: List[Dict[str, Any]],
    max_tokens: int = 2000,
    group_by_type: bool = True
) -> Dict[str, Any]:
    """
    Compress episodes into token-bounded narrative

    Strategy:
    1. Group episodes by type (RFP, TRANSFER, PARTNERSHIP, etc.)
    2. Sort by time within each group
    3. Format as bullet points
    4. Estimate token count
    5. Truncate if exceeds max_tokens
    6. Return with metadata

    Args:
        episodes: List of episode dictionaries
        max_tokens: Maximum tokens in narrative (default: 2000)
        group_by_type: Whether to group episodes by type

    Returns:
        Dictionary with:
            - narrative: Compressed narrative text
            - episode_count: Number of episodes included
            - total_episodes: Total episodes available
            - estimated_tokens: Token count of narrative
            - truncated: Whether narrative was truncated
    """
    if not episodes:
        return {
            'narrative': 'No episodes found for the specified criteria.',
            'episode_count': 0,
            'total_episodes': 0,
            'estimated_tokens': 0,
            'truncated': False
        }

    logger.info(f"Building narrative from {len(episodes)} episodes (max_tokens: {max_tokens})")

    # Group episodes by type
    if group_by_type:
        groups = defaultdict(list)
        for ep in episodes:
            ep_type = ep.get('episode_type', 'OTHER')
            groups[ep_type].append(ep)
    else:
        groups = {'ALL': episodes}

    # Build narrative sections
    narrative_parts = []

    # Add header
    time_range = _get_time_range(episodes)
    header = f"# Temporal Narrative ({len(episodes)} episodes"
    if time_range:
        header += f": {time_range['from']} to {time_range['to']}"
    header += ")\n\n"
    narrative_parts.append(header)

    episodes_included = 0
    truncated = False

    # Process each group
    for ep_type, type_episodes in sorted(groups.items()):
        # Sort by timestamp
        sorted_eps = sorted(
            type_episodes,
            key=lambda e: e.get('timestamp') or e.get('created_at') or '',
            reverse=True
        )

        # Add section header
        section = f"## {ep_type.replace('_', ' ').title()}\n\n"
        narrative_parts.append(section)

        # Add episodes as bullets
        for ep in sorted_eps:
            bullet = _format_episode_bullet(ep)
            narrative_parts.append(bullet + "\n")
            episodes_included += 1

            # Check token count
            current_narrative = ''.join(narrative_parts)
            current_tokens = estimate_tokens(current_narrative)

            if current_tokens >= max_tokens:
                # Remove last episode that exceeded limit
                narrative_parts.pop()
                episodes_included -= 1
                truncated = True

                # Add truncation notice
                narrative_parts.append(f"\n*... Narrative truncated at {max_tokens} tokens ({episodes_included}/{len(episodes)} episodes shown)*\n")
                break

        if truncated:
            break

    narrative = ''.join(narrative_parts)
    final_tokens = estimate_tokens(narrative)

    logger.info(f"Narrative built: {episodes_included}/{len(episodes)} episodes, ~{final_tokens} tokens (truncated: {truncated})")

    return {
        'narrative': narrative,
        'episode_count': episodes_included,
        'total_episodes': len(episodes),
        'estimated_tokens': final_tokens,
        'truncated': truncated,
        'time_range': time_range
    }


def _get_time_range(episodes: List[Dict[str, Any]]) -> Dict[str, str]:
    """Extract time range from episodes"""
    timestamps = []
    for ep in episodes:
        ts = ep.get('timestamp') or ep.get('created_at') or ep.get('valid_at')
        if ts:
            timestamps.append(ts)

    if not timestamps:
        return {}

    timestamps.sort()
    return {
        'from': timestamps[0],
        'to': timestamps[-1]
    }


def _format_episode_bullet(episode: Dict[str, Any]) -> str:
    """
    Format episode as bullet point

    Args:
        episode: Episode dictionary

    Returns:
        Formatted bullet string
    """
    # Extract key fields
    timestamp = episode.get('timestamp') or episode.get('created_at') or episode.get('valid_at')
    content = episode.get('content') or episode.get('description') or 'No description'
    entity = episode.get('entity_name') or episode.get('entity_id') or 'Unknown'

    # Format timestamp
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            ts_str = dt.strftime('%Y-%m-%d')
        except:
            ts_str = str(timestamp)[:10]
    else:
        ts_str = 'Unknown date'

    # Build bullet
    bullet = f"- **{ts_str}** ({entity}): "

    # Add confidence score if available
    confidence = episode.get('confidence_score')
    if confidence is not None:
        bullet += f"[{confidence:.0%}] "

    # Add content
    if content and content != 'No description':
        # Truncate long content
        if len(content) > 100:
            content = content[:97] + "..."
        bullet += content

    # Add metadata
    metadata = episode.get('metadata', {})
    if metadata:
        meta_parts = []
        if 'source' in metadata:
            meta_parts.append(f"source: {metadata['source']}")
        if 'category' in metadata:
            meta_parts.append(f"category: {metadata['category']}")
        if meta_parts:
            bullet += f" ({', '.join(meta_parts)})"

    return bullet


def build_comparison_narrative(
    entity_id: str,
    diff_result: Dict[str, Any],
    max_tokens: int = 1500
) -> Dict[str, Any]:
    """
    Build narrative from entity diff result

    Args:
        entity_id: Entity identifier
        diff_result: Result from compute_entity_diff
        max_tokens: Maximum tokens in narrative

    Returns:
        Narrative dictionary
    """
    narrative_parts = []

    # Header
    time_range = diff_result.get('time_range', {})
    header = f"# Changes for {entity_id}\n\n"
    if time_range:
        header += f"**Period:** {time_range.get('from')} to {time_range.get('to')}\n\n"
    narrative_parts.append(header)

    changes = diff_result.get('changes', {})
    summary = diff_result.get('summary', {})

    # Summary
    narrative_parts.append("## Summary\n\n")
    narrative_parts.append(f"- Total changes: {summary.get('total_changes', 0)}\n")
    narrative_parts.append(f"- Relationships added: {summary.get('relationships_added', 0)}\n")
    narrative_parts.append(f"- Relationships removed: {summary.get('relationships_removed', 0)}\n")
    narrative_parts.append(f"- Relationships changed: {summary.get('relationships_changed', 0)}\n")
    narrative_parts.append(f"- Properties changed: {summary.get('properties_changed', 0)}\n\n")

    # New relationships
    new_rels = changes.get('new_relationships', [])
    if new_rels:
        narrative_parts.append("## New Relationships\n\n")
        for rel_info in new_rels:
            target = rel_info.get('target')
            rel_type = rel_info.get('rel', {}).get('type', 'RELATED_TO')
            narrative_parts.append(f"- + {rel_type} → {target}\n")
        narrative_parts.append("\n")

    # Ended relationships
    ended_rels = changes.get('ended_relationships', [])
    if ended_rels:
        narrative_parts.append("## Ended Relationships\n\n")
        for rel_info in ended_rels:
            target = rel_info.get('target')
            rel_type = rel_info.get('rel', {}).get('type', 'RELATED_TO')
            narrative_parts.append(f"- - {rel_type} → {target}\n")
        narrative_parts.append("\n")

    # Property changes
    prop_changes = changes.get('property_changes', [])
    if prop_changes:
        narrative_parts.append("## Property Changes\n\n")
        for change in prop_changes:
            prop = change.get('property')
            before = change.get('before')
            after = change.get('after')
            narrative_parts.append(f"- **{prop}**: `{before}` → `{after}`\n")
        narrative_parts.append("\n")

    narrative = ''.join(narrative_parts)
    tokens = estimate_tokens(narrative)

    return {
        'narrative': narrative,
        'estimated_tokens': tokens,
        'truncated': tokens > max_tokens,
        'entity_id': entity_id,
        'changes_summary': summary
    }


if __name__ == "__main__":
    # Test narrative builder
    import asyncio

    # Sample episodes
    test_episodes = [
        {
            'episode_type': 'RFP_DETECTED',
            'entity_name': 'Arsenal FC',
            'timestamp': '2024-01-15T10:00:00Z',
            'content': 'Digital transformation RFP for CRM system',
            'confidence_score': 0.92,
            'metadata': {'source': 'LinkedIn', 'category': 'Technology'}
        },
        {
            'episode_type': 'PARTNERSHIP_FORMED',
            'entity_name': 'Arsenal FC',
            'timestamp': '2024-02-01T14:30:00Z',
            'content': 'Partnership with Salesforce announced',
            'metadata': {'source': 'Press Release'}
        },
        {
            'episode_type': 'EXECUTIVE_CHANGE',
            'entity_name': 'Arsenal FC',
            'timestamp': '2024-03-10T09:15:00Z',
            'content': 'New CTO appointed',
            'metadata': {'source': 'News'}
        }
    ]

    result = build_narrative_from_episodes(test_episodes, max_tokens=500)
    print("Narrative:")
    print(result['narrative'])
    print(f"\nTokens: {result['estimated_tokens']}")
    print(f"Truncated: {result['truncated']}")
