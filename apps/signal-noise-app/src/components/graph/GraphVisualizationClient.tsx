'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import SimpleGraph from './SimpleGraph';
import GraphControls from './GraphControls';
import GraphPerformanceControls from './GraphPerformanceControls';
import NodeContextPanel from './NodeContextPanel';
import { GraphNode, GraphEdge } from './graph-types';

interface GraphVisualizationClientProps {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  totalAvailableNodes?: number;
  onLoadMoreNodes?: (count: number) => Promise<void>;
}

export default function GraphVisualizationClient({ 
  initialNodes, 
  initialEdges,
  totalAvailableNodes = 0,
  onLoadMoreNodes
}: GraphVisualizationClientProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNodeType, setSelectedNodeType] = useState('all');
  const [showLinkLabels, setShowLinkLabels] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(false);
  const [showClustered, setShowClustered] = useState(false);
  const [clusteredNodes, setClusteredNodes] = useState<GraphNode[]>([]);
  const [detailLevel, setDetailLevel] = useState(2);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setIsContextPanelOpen(true);
  }, []);

  const handleResetView = useCallback(() => {
    console.log('🔄 Resetting view to default state');
  }, []);

  const filteredNodes = initialNodes;
  const filteredEdges = initialEdges;
  const displayNodes = showClustered && clusteredNodes.length > 0 ? clusteredNodes : filteredNodes;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Graph Visualization */}
      <div className="flex-1">
        <div className="bg-custom-box border-custom-border rounded-lg p-4">
          <h2 className="text-xl text-white mb-4">Interactive Network Graph</h2>
          <div id="graph-container" className="relative bg-custom-bg" style={{ height: '500px' }}>
            <SimpleGraph
              data={{
                nodes: displayNodes,
                links: filteredEdges
              }}
              width={dimensions.width}
              height={dimensions.height}
              onNodeClick={handleNodeClick}
              detailLevel={detailLevel}
            />
          </div>
        </div>
      </div>

      {/* Controls Panel - Enhanced */}
      <div className="lg:w-80">
        <div className="bg-custom-box border-custom-border rounded-lg p-4">
          <h3 className="text-lg text-white mb-4">Graph Controls</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-fm-light-grey block mb-2">Node Type Filter</label>
              <select 
                value={selectedNodeType} 
                onChange={(e) => setSelectedNodeType(e.target.value)}
                className="w-full bg-custom-bg border border-custom-border rounded px-3 py-2 text-white"
              >
                <option value="all">All Types</option>
                <option value="club">Clubs</option>
                <option value="sportsperson">Sportspeople</option>
                <option value="poi">POIs</option>
                <option value="tender">Tenders</option>
                <option value="league">Leagues</option>
                <option value="venue">Venues</option>
              </select>
            </div>
            
            <GraphPerformanceControls
              totalNodes={totalAvailableNodes}
              currentNodes={displayNodes.length}
              onLoadMore={() => {}}
              onToggleClustering={() => {}}
              onAdjustDetail={() => {}}
            />
            
            <div className="text-sm text-fm-medium-grey">
              <div>📊 Showing {displayNodes.length} nodes</div>
              <div>🔗 Showing {filteredEdges.length} relationships</div>
              <div>🎯 Click nodes to expand graph</div>
              <div>🎯 Detail Level: {detailLevel}/3</div>
            </div>
            
            <button
              onClick={handleResetView}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              Reset View
            </button>
          </div>
        </div>
      </div>

      {/* Context Panel */}
      {isContextPanelOpen && selectedNode && (
        <NodeContextPanel
          node={selectedNode}
          isOpen={isContextPanelOpen}
          onClose={() => setIsContextPanelOpen(false)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}