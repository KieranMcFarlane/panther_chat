'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface GraphNode {
  id: string;
  label: string;
  type: 'club' | 'sportsperson' | 'poi' | 'tender' | 'league' | 'venue';
  x?: number;
  y?: number;
  color: string;
  size: number;
  description?: string;
  data?: any;
}

interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  label?: string;
  type?: string;
  color?: string;
}

interface SimpleGraphProps {
  data: {
    nodes: GraphNode[];
    links: GraphEdge[];
  };
  width: number;
  height: number;
  onNodeClick?: (node: GraphNode) => void;
  detailLevel?: number; // 1-3 scale for level of detail
}

export default function SimpleGraph({ 
  data, 
  width, 
  height, 
  onNodeClick,
  detailLevel = 1
}: SimpleGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Simple node positioning - arrange in a circle
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    // Position nodes in a circle
    const nodePositions = new Map();
    data.nodes.forEach((node, index) => {
      const angle = (index / data.nodes.length) * 2 * Math.PI;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      nodePositions.set(node.id, { x, y });
    });

    // Level of detail settings
    const showLabels = detailLevel >= 2;
    const showAllEdges = detailLevel >= 2;
    const showEdgeLabels = detailLevel >= 3;
    const labelFontSize = detailLevel >= 3 ? 14 : 12;
    
    // Draw edges based on detail level
    if (showAllEdges) {
      data.links.forEach(link => {
        const source = nodePositions.get(link.source);
        const target = nodePositions.get(link.target);
        if (source && target) {
          ctx.strokeStyle = link.color || '#6b7280';
          ctx.lineWidth = detailLevel >= 3 ? (link.strength * 3) || 2 : 1;
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          
          // Draw edge labels at highest detail level
          if (showEdgeLabels && link.label) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px Sans-Serif';
            ctx.textAlign = 'center';
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            ctx.fillText(link.label, midX, midY);
          }
        }
      });
    } else {
      // Show only strong edges at low detail
      data.links.forEach(link => {
        if ((link.strength || 0.8) >= 0.8) {
          const source = nodePositions.get(link.source);
          const target = nodePositions.get(link.target);
          if (source && target) {
            ctx.strokeStyle = link.color || '#6b7280';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
          }
        }
      });
    }

    // Draw nodes with level of detail
    nodePositions.forEach((pos, nodeId) => {
      const node = data.nodes.find(n => n.id === nodeId);
      if (!node) return;

      // Adjust node size based on detail level
      const nodeSize = (node.size || 12) * (detailLevel >= 2 ? 1 : 0.8);

      // Draw node circle
      ctx.fillStyle = node.color || '#3b82f6';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeSize, 0, 2 * Math.PI);
      ctx.fill();

      // Draw node border at higher detail levels
      if (detailLevel >= 2) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw labels based on detail level
      if (showLabels) {
        ctx.fillStyle = 'white';
        ctx.font = `${labelFontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        
        // Truncate long labels at lower detail levels
        let displayLabel = node.label;
        if (detailLevel === 2 && node.label.length > 15) {
          displayLabel = node.label.substring(0, 12) + '...';
        } else if (detailLevel === 1 && node.label.length > 10) {
          displayLabel = node.label.substring(0, 8) + '...';
        }
        
        ctx.fillText(displayLabel, pos.x, pos.y - nodeSize - 5);
        
        // Show node type at highest detail level
        if (detailLevel >= 3 && node.type) {
          ctx.fillStyle = '#9ca3af';
          ctx.font = '10px Sans-Serif';
          ctx.fillText(`(${node.type})`, pos.x, pos.y - nodeSize - 20);
        }
      }
    });

    // Handle click events
    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      nodePositions.forEach((pos, nodeId) => {
        const node = data.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
        if (distance <= (node.size || 12)) {
          onNodeClick?.(node);
        }
      });
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [data, width, height, onNodeClick, detailLevel]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-custom-border rounded-lg"
      />
      <div className="absolute top-4 right-4 bg-custom-box border border-custom-border rounded-lg px-3 py-2">
        <div className="text-xs text-fm-light-grey">
          Simple Graph: {data.nodes.length} nodes, {data.links.length} edges (Detail: {detailLevel}/3)
        </div>
      </div>
    </div>
  );
}