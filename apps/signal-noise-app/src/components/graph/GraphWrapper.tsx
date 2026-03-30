'use client';

import GraphVisualizationClient from './GraphVisualizationClient';
import { GraphNode, GraphEdge } from './graph-types';

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
  return (
    <GraphVisualizationClient
      initialNodes={initialNodes}
      initialEdges={initialEdges}
      totalAvailableNodes={totalAvailableNodes}
    />
  );
}
