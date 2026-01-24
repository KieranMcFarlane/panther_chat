'use client';

import { useCopilotAction } from '@copilotkit/react-core';

/**
 * TemporalIntelligenceTools
 *
 * Registers temporal intelligence tools as CopilotKit actions.
 * These tools allow the AI to analyze entity timelines, RFP fit scores,
 * and aggregate temporal patterns across the sports intelligence database.
 *
 * This component renders nothing to the DOM - it only registers tools.
 */
export function TemporalIntelligenceTools() {
  // Tool 1: Get Entity Timeline
  useCopilotAction({
    name: 'get_entity_timeline',
    description: 'Get complete temporal history of a sports entity including RFPs, partnerships, and changes over time',
    parameters: [
      {
        name: 'entity_id',
        type: 'string',
        description: 'Entity identifier (name or neo4j_id)',
        required: true
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Number of events to return (default: 50)',
        required: false
      }
    ],
    handler: async ({ entity_id, limit = 50 }) => {
      const response = await fetch(
        `/api/temporal/entity/${encodeURIComponent(entity_id)}/timeline?limit=${limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch timeline');
      return await response.json();
    }
  });

  // Tool 2: Analyze Temporal Fit
  useCopilotAction({
    name: 'analyze_temporal_fit',
    description: 'Analyze how well an entity fits an RFP opportunity based on their temporal patterns',
    parameters: [
      {
        name: 'entity_id',
        type: 'string',
        description: 'Entity identifier (name or neo4j_id)',
        required: true
      },
      {
        name: 'rfp_id',
        type: 'string',
        description: 'RFP identifier',
        required: true
      },
      {
        name: 'rfp_category',
        type: 'string',
        description: 'RFP category (optional)',
        required: false
      },
      {
        name: 'rfp_value',
        type: 'number',
        description: 'Estimated RFP value (optional)',
        required: false
      },
      {
        name: 'time_horizon',
        type: 'number',
        description: 'Days to look back for analysis (default: 90)',
        required: false
      }
    ],
    handler: async (args) => {
      const response = await fetch('/api/temporal/analyze-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      return await response.json();
    }
  });

  // Tool 3: Get Temporal Patterns
  useCopilotAction({
    name: 'get_temporal_patterns',
    description: 'Get aggregate temporal patterns across all entities including RFP trends and activity statistics',
    parameters: [
      {
        name: 'entity_type',
        type: 'string',
        description: 'Filter by entity type (optional)',
        required: false
      },
      {
        name: 'time_horizon',
        type: 'number',
        description: 'Days to look back (default: 365)',
        required: false
      }
    ],
    handler: async ({ entity_type, time_horizon = 365 }) => {
      const params = new URLSearchParams();
      if (entity_type) params.append('entity_type', entity_type);
      params.append('time_horizon', String(time_horizon));

      const response = await fetch(`/api/temporal/patterns?${params}`);
      return await response.json();
    }
  });

  // Tool 4: Create RFP Episode
  useCopilotAction({
    name: 'create_rfp_episode',
    description: 'Record an RFP detection as a temporal episode for tracking and future analysis',
    parameters: [
      {
        name: 'rfp_id',
        type: 'string',
        description: 'Unique RFP identifier',
        required: true
      },
      {
        name: 'organization',
        type: 'string',
        description: 'Organization name',
        required: true
      },
      {
        name: 'entity_type',
        type: 'string',
        description: 'Entity type (Club, League, etc.)',
        required: true
      },
      {
        name: 'title',
        type: 'string',
        description: 'RFP title',
        required: true
      },
      {
        name: 'description',
        type: 'string',
        description: 'RFP description',
        required: true
      },
      {
        name: 'source',
        type: 'string',
        description: 'Detection source (LinkedIn, Perplexity, etc.)',
        required: true
      },
      {
        name: 'url',
        type: 'string',
        description: 'RFP URL',
        required: true
      },
      {
        name: 'category',
        type: 'string',
        description: 'RFP category',
        required: true
      },
      {
        name: 'confidence_score',
        type: 'number',
        description: 'Detection confidence (0-1)',
        required: true
      }
    ],
    handler: async (args) => {
      const response = await fetch('/api/temporal/rfp-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      return await response.json();
    }
  });

  // No UI - this component only registers tools
  return null;
}
