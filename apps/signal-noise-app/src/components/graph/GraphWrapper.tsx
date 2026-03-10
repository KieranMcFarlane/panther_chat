'use client';

import { useState } from 'react';
import GraphVisualizationClient from './GraphVisualizationClient';
import { GraphNode, GraphEdge } from './graph-types';
import { resolveGraphId } from '@/lib/graph-id';

interface GraphWrapperProps {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  totalAvailableNodes?: number;
}

export default function GraphWrapper({ 
  initialNodes, 
  initialEdges,
  totalAvailableNodes = 1000
}: GraphWrapperProps) {
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges] = useState<GraphEdge[]>(initialEdges);
  const [totalNodes, setTotalNodes] = useState(totalAvailableNodes);

  const handleLoadMoreNodes = async (count: number) => {
    console.log(`🔄 Loading ${count} more nodes...`);
    
    try {
      // Calculate current page based on existing nodes
      const currentPage = Math.floor(nodes.length / 500) + 1;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(Math.max(1, count)),
        entityType: 'all',
      });
      const response = await fetch(`/api/entities?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load entities: ${response.status}`);
      }
      const additionalResult = await response.json();
      
      if (additionalResult.entities && additionalResult.entities.length > 0) {
        // Convert new entities to graph nodes
        const newNodes = additionalResult.entities.map((cachedEntity: any) => {
          const properties = cachedEntity.properties || {};
          const labels = cachedEntity.labels || [];
          
          // Determine entity type from labels
          let entityType = 'entity';
          let color = '#3b82f6'; // Default blue
          let size = 12; // Default size
          
          if (labels.includes('Club') || labels.includes('Company')) {
            entityType = 'club';
            color = '#3b82f6';
            size = 16;
          } else if (labels.includes('League')) {
            entityType = 'league';
            color = '#ef4444';
            size = 18;
          } else if (labels.includes('Competition')) {
            entityType = 'competition';
            color = '#f59e0b';
            size = 14;
          } else if (labels.includes('Venue') || labels.includes('Stadium')) {
            entityType = 'venue';
            color = '#8b5cf6';
            size = 15;
          } else if (labels.includes('RfpOpportunity') || labels.includes('RFP')) {
            entityType = 'tender';
            color = '#eab308';
            size = 13;
          } else if (labels.includes('Stakeholder')) {
            entityType = 'poi';
            color = '#a855f7';
            size = 14;
          } else if (labels.includes('Person') || labels.includes('Sportsperson')) {
            entityType = 'sportsperson';
            color = '#10b981';
            size = 14;
          }
          
          return {
            id: resolveGraphId(cachedEntity) || cachedEntity.id,
            label: properties.name || 'Unknown Entity',
            type: entityType,
            color,
            size,
            description: properties.description || `${entityType} entity`,
            properties: {
              entity_id: resolveGraphId(cachedEntity) || cachedEntity.id,
              entity_type: entityType,
              name: properties.name || 'Unknown Entity',
              description: properties.description || '',
              source: 'supabase-cache',
              last_updated: properties.last_updated || new Date().toISOString(),
              trust_score: properties.trust_score || 0.8,
              priority_score: properties.priority_score || 0.7,
              location: properties.location || properties.city || properties.country || '',
              tags: properties.tags || [],
              ...properties
            }
          };
        });
        
        // Add new nodes to existing ones
        setNodes(prev => [...prev, ...newNodes]);
        
        // TODO: Add additional edges for new nodes
        // For now, we'll just add the nodes without additional relationships
        
        console.log(`✅ Successfully loaded ${newNodes.length} additional nodes`);
      }
    } catch (error) {
      console.error('❌ Failed to load more nodes:', error);
      throw error;
    }
  };

  return (
    <GraphVisualizationClient
      initialNodes={nodes}
      initialEdges={edges}
      totalAvailableNodes={totalNodes}
      onLoadMoreNodes={handleLoadMoreNodes}
    />
  );
}
