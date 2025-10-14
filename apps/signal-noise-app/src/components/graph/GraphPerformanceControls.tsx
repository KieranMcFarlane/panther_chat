'use client';

import { useState } from 'react';
import { Settings, ZoomIn, ZoomOut, RefreshCw, Download, Filter } from 'lucide-react';

interface GraphPerformanceControlsProps {
  totalNodes: number;
  currentNodes: number;
  onLoadMore?: (count: number) => void;
  onToggleClustering?: (enabled: boolean) => void;
  onAdjustDetail?: (level: number) => void;
}

export default function GraphPerformanceControls({
  totalNodes,
  currentNodes,
  onLoadMore,
  onToggleClustering,
  onAdjustDetail
}: GraphPerformanceControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(false);
  const [detailLevel, setDetailLevel] = useState(1); // 1-3 scale

  const handleLoadMore = (count: number) => {
    if (onLoadMore) {
      onLoadMore(count);
    }
  };

  const handleToggleClustering = () => {
    const newState = !clusteringEnabled;
    setClusteringEnabled(newState);
    if (onToggleClustering) {
      onToggleClustering(newState);
    }
  };

  const handleDetailChange = (level: number) => {
    setDetailLevel(level);
    if (onAdjustDetail) {
      onAdjustDetail(level);
    }
  };

  return (
    <div className="bg-custom-box border-custom-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Performance Controls
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-fm-light-grey hover:text-white transition-colors"
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Basic stats always visible */}
      <div className="text-sm text-fm-light-grey">
        <div>📊 Current: {currentNodes.toLocaleString()} nodes</div>
        <div>🗄️ Total Available: {totalNodes.toLocaleString()} nodes</div>
        <div>💾 Memory: ~{Math.round(currentNodes * 0.5)}KB estimated</div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Loading Controls */}
          <div>
            <label className="text-sm text-fm-light-grey block mb-2">
              Load More Nodes
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleLoadMore(200)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                disabled={currentNodes >= totalNodes}
              >
                +200
              </button>
              <button
                onClick={() => handleLoadMore(500)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                disabled={currentNodes >= totalNodes}
              >
                +500
              </button>
              <button
                onClick={() => handleLoadMore(1000)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                disabled={currentNodes >= totalNodes}
              >
                +1000
              </button>
            </div>
          </div>

          {/* Clustering Toggle */}
          <div>
            <label className="text-sm text-fm-light-grey block mb-2">
              Node Clustering
            </label>
            <button
              onClick={handleToggleClustering}
              className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                clusteringEnabled
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {clusteringEnabled ? '✅ Clustering Enabled' : '❌ Clustering Disabled'}
            </button>
            <p className="text-xs text-fm-medium-grey mt-1">
              Groups similar nodes to reduce visual complexity
            </p>
          </div>

          {/* Detail Level */}
          <div>
            <label className="text-sm text-fm-light-grey block mb-2">
              Detail Level: {detailLevel}/3
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  onClick={() => handleDetailChange(level)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    detailLevel === level
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-600 hover:bg-gray-500 text-white'
                  }`}
                >
                  {level === 1 ? 'Low' : level === 2 ? 'Medium' : 'High'}
                </button>
              ))}
            </div>
            <p className="text-xs text-fm-medium-grey mt-1">
              Controls amount of detail shown for each node
            </p>
          </div>

          {/* Performance Tips */}
          <div className="bg-gray-800 rounded p-3">
            <h4 className="text-sm font-semibold text-white mb-2">⚡ Performance Tips</h4>
            <ul className="text-xs text-fm-medium-grey space-y-1">
              <li>• Keep under 1,000 nodes for smooth interactions</li>
              <li>• Enable clustering for large datasets</li>
              <li>• Use lower detail levels on slower devices</li>
              <li>• Click nodes to explore relationships incrementally</li>
              <li>• Use filters to focus on relevant entity types</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}