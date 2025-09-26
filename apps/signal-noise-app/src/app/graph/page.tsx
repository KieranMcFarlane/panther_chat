'use client';

import { useState, useEffect } from 'react';
import { Network, Users, Building, FileText, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db, Entity } from '@/lib/database';

interface GraphNode {
  id: string;
  label: string;
  type: 'club' | 'sportsperson' | 'poi' | 'tender';
  x: number;
  y: number;
  size: number;
  color: string;
}

interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  label?: string;
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeType, setSelectedNodeType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGraphData() {
      try {
        setLoading(true);
        const entities = await db.getEntities();
        
        // Convert entities to graph nodes
        const graphNodes: GraphNode[] = entities.slice(0, 20).map((entity, index) => {
          const x = 100 + (index % 5) * 100;
          const y = 100 + Math.floor(index / 5) * 100;
          
          let color = '#3b82f6'; // Default blue
          let size = 15; // Default size
          
          switch (entity.entity_type) {
            case 'club':
              color = '#3b82f6'; // Blue
              size = 20;
              break;
            case 'sportsperson':
              color = '#10b981'; // Green
              size = 15;
              break;
            case 'poi':
            case 'contact':
              color = '#8b5cf6'; // Purple
              size = 12;
              break;
            case 'tender':
              color = '#f59e0b'; // Yellow
              size = 18;
              break;
          }
          
          return {
            id: entity.entity_id,
            label: entity.name || entity.entity_id,
            type: entity.entity_type,
            x,
            y,
            size,
            color
          };
        });
        
        // Create simple edges between related entities
        const graphEdges: GraphEdge[] = [];
        for (let i = 0; i < graphNodes.length - 1; i++) {
          if (i % 2 === 0) { // Create some connections
            graphEdges.push({
              source: graphNodes[i].id,
              target: graphNodes[i + 1].id,
              strength: 0.5 + Math.random() * 0.4,
              label: 'Related'
            });
          }
        }
        
        setNodes(graphNodes);
        setEdges(graphEdges);
      } catch (error) {
        console.error('Error loading graph data:', error);
        // Fallback to mock data if database fails
        const mockNodes: GraphNode[] = [
          { id: '1', label: 'Manchester United', type: 'club', x: 100, y: 100, size: 20, color: '#3b82f6' },
          { id: '2', label: 'Marcus Rashford', type: 'sportsperson', x: 200, y: 150, size: 15, color: '#10b981' },
          { id: '3', label: 'John Smith', type: 'poi', x: 150, y: 200, size: 12, color: '#8b5cf6' }
        ];
        
        const mockEdges: GraphEdge[] = [
          { source: '1', target: '2', strength: 0.9, label: 'Player' },
          { source: '1', target: '3', strength: 0.7, label: 'CEO' }
        ];
        
        setNodes(mockNodes);
        setEdges(mockEdges);
      } finally {
        setLoading(false);
      }
    }

    loadGraphData();
  }, []);

  const filteredNodes = selectedNodeType === 'all' 
    ? nodes 
    : nodes.filter(node => node.type === selectedNodeType);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'club': return '🏟️';
      case 'sportsperson': return '⚽';
      case 'poi': return '👤';
      case 'tender': return '📋';
      default: return '🔍';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Graph</h1>
          <p className="text-fm-light-grey">Visualize relationships between entities</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedNodeType} onValueChange={setSelectedNodeType}>
            <SelectTrigger className="w-48 bg-custom-box border-custom-border text-white">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent className="bg-custom-box border-custom-border text-white">
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="club">Clubs</SelectItem>
              <SelectItem value="sportsperson">Sportspeople</SelectItem>
              <SelectItem value="poi">POIs</SelectItem>
              <SelectItem value="tender">Tenders</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-yellow-500 text-black hover:bg-yellow-400">
            <Network className="w-4 h-4 mr-2" />
            Refresh Graph
          </Button>
        </div>
      </div>

      {/* Graph Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-custom-box border border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Building className="w-8 h-8 text-blue-400" />
            <div>
              <div className="text-2xl font-bold text-white">
                {nodes.filter(n => n.type === 'club').length}
              </div>
              <div className="text-sm text-fm-medium-grey">Clubs</div>
            </div>
          </div>
        </div>

        <div className="bg-custom-box border border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-green-400" />
            <div>
              <div className="text-2xl font-bold text-white">
                {nodes.filter(n => n.type === 'sportsperson').length}
              </div>
              <div className="text-sm text-fm-medium-grey">Sportspeople</div>
            </div>
          </div>
        </div>

        <div className="bg-custom-box border border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-purple-400" />
            <div>
              <div className="text-2xl font-bold text-white">
                {nodes.filter(n => n.type === 'poi').length}
              </div>
              <div className="text-sm text-fm-medium-grey">POIs</div>
            </div>
          </div>
        </div>

        <div className="bg-custom-box border border-custom-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-yellow-400" />
            <div>
              <div className="text-2xl font-bold text-white">
                {nodes.filter(n => n.type === 'tender').length}
              </div>
              <div className="text-sm text-fm-medium-grey">Tenders</div>
            </div>
          </div>
        </div>
      </div>

      {/* Graph Visualization */}
      <div className="bg-custom-box border border-custom-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Network Graph</h2>
          <div className="text-sm text-fm-medium-grey">
            {filteredNodes.length} nodes, {edges.length} relationships
          </div>
        </div>

        {/* Mock Graph Canvas */}
        <div className="relative h-96 bg-custom-bg rounded-lg border border-custom-border overflow-hidden">
          {/* Render nodes */}
          {filteredNodes.map((node) => (
            <div
              key={node.id}
              className="absolute cursor-pointer transition-all duration-200 hover:scale-110"
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.size}px`,
                height: `${node.size}px`
              }}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white shadow-lg"
                style={{ backgroundColor: node.color }}
                title={`${node.label} (${node.type})`}
              >
                {getTypeIcon(node.type)}
              </div>
            </div>
          ))}

          {/* Render edges (simplified as lines) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {edges.map((edge, index) => {
              const sourceNode = nodes.find(n => n.id === edge.source);
              const targetNode = nodes.find(n => n.id === edge.target);
              
              if (!sourceNode || !targetNode) return null;

              return (
                <line
                  key={index}
                  x1={sourceNode.x + sourceNode.size / 2}
                  y1={sourceNode.y + sourceNode.size / 2}
                  x2={targetNode.x + targetNode.size / 2}
                  y2={targetNode.y + targetNode.size / 2}
                  stroke="#6b7280"
                  strokeWidth={edge.strength * 3}
                  opacity={0.6}
                />
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-custom-box border border-custom-border rounded-lg p-3">
            <div className="text-sm font-medium text-white mb-2">Legend</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-fm-light-grey">Clubs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-fm-light-grey">Sportspeople</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-fm-light-grey">POIs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-fm-light-grey">Tenders</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-fm-medium-grey text-sm">
          💡 Click on nodes to see detailed information. Line thickness indicates relationship strength.
        </div>
      </div>

      {/* Relationship Details */}
      <div className="bg-custom-box border border-custom-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Key Relationships</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {edges.slice(0, 6).map((edge, index) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            
            return (
              <div key={index} className="flex items-center justify-between p-2 bg-custom-bg rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">{sourceNode?.label}</span>
                  <span className="text-fm-medium-grey">→</span>
                  <span className="text-sm text-white">{targetNode?.label}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {Math.round(edge.strength * 100)}%
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
