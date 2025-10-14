'use client';

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph2D to avoid SSR issues with loading fallback
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').catch(err => {
    console.error('Failed to load react-force-graph-2d:', err);
    return null;
  }), 
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-64">Loading graph visualization...</div>
  }
);

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

interface BloomGraph2DProps {
  data: {
    nodes: GraphNode[];
    links: GraphEdge[];
  };
  width: number;
  height: number;
  onNodeClick?: (node: GraphNode) => void;
  enableBloom?: boolean;
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  linkOpacity?: number;
  showLinkLabels?: boolean;
}

// Declare interface to expose graph methods
export interface BloomGraph2DRef {
  zoomToFit: (duration?: number) => void;
  zoom: (scale: number, duration?: number) => void;
  cameraPosition: (position: { x?: number; y?: number; z?: number }, duration?: number) => void;
  centerAt: (position: { x: number; y: number }, duration?: number) => void;
}

const BloomGraph2D = React.forwardRef<BloomGraph2DRef, BloomGraph2DProps>(
  ({
    data,
    width,
    height,
    onNodeClick,
    enableBloom = true,
    bloomIntensity = 1.5,
    bloomThreshold = 0.8,
    bloomRadius = 0.8,
    linkOpacity = 0.8,
    showLinkLabels = true
  }: BloomGraph2DProps, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<any>();
  const [isInitialized, setIsInitialized] = useState(false);
  const animationFrameRef = useRef<number>();
  const bloomCanvasRef = useRef<HTMLCanvasElement>();
  const bloomContextRef = useRef<CanvasRenderingContext2D>();

  // Initialize bloom effect canvas
  const initializeBloom = useCallback(() => {
    if (!enableBloom || !canvasRef.current) return;

    // Create bloom canvas
    const bloomCanvas = document.createElement('canvas');
    bloomCanvas.width = width;
    bloomCanvas.height = height;
    bloomCanvasRef.current = bloomCanvas;
    bloomContextRef.current = bloomCanvas.getContext('2d')!;

    setIsInitialized(true);
  }, [enableBloom, width, height]);

  // Apply bloom effect to the main canvas
  const applyBloomEffect = useCallback(() => {
    if (!enableBloom || !canvasRef.current || !bloomCanvasRef.current || !bloomContextRef.current) {
      return;
    }

    const mainCanvas = canvasRef.current;
    const mainContext = mainCanvas.getContext('2d')!;
    const bloomCanvas = bloomCanvasRef.current;
    const bloomContext = bloomContextRef.current;

    // Clear bloom canvas
    bloomContext.clearRect(0, 0, width, height);

    // Apply blur for bloom effect
    bloomContext.filter = `blur(${bloomRadius * 10}px) brightness(${bloomIntensity})`;
    bloomContext.globalAlpha = bloomThreshold;
    bloomContext.drawImage(mainCanvas, 0, 0);

    // Reset filter and composite mode
    bloomContext.filter = 'none';
    bloomContext.globalCompositeOperation = 'screen';
    bloomContext.globalAlpha = 1.0;
    bloomContext.drawImage(mainCanvas, 0, 0);

    // Copy bloom result back to main canvas
    mainContext.clearRect(0, 0, width, height);
    mainContext.drawImage(bloomCanvas, 0, 0);
  }, [enableBloom, width, height, bloomIntensity, bloomThreshold, bloomRadius]);

  // Enhanced node rendering with glow effect and larger click area
  const renderNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = node.size || 12;
    const scaledSize = size / globalScale;
    
    // Draw larger invisible interaction area
    if (!enableBloom) {
      ctx.save();
      ctx.fillStyle = 'transparent';
      ctx.beginPath();
      ctx.arc(node.x, node.y, scaledSize * 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
    
    // Draw glow effect for bloom
    if (enableBloom) {
      ctx.save();
      ctx.shadowColor = node.color || '#3b82f6';
      ctx.shadowBlur = scaledSize * 3;
      ctx.fillStyle = node.color || '#3b82f6';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(node.x, node.y, scaledSize * 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }

    // Draw main node with stronger border
    ctx.save();
    ctx.fillStyle = node.color || '#3b82f6';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = scaledSize * 0.3;
    ctx.beginPath();
    ctx.arc(node.x, node.y, scaledSize * 1.2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Draw label
    const label = node.label;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Text background for better readability
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    const padding = fontSize * 0.3;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(
      node.x - textWidth / 2 - padding,
      node.y - textHeight / 2 - padding - scaledSize * 2.5,
      textWidth + padding * 2,
      textHeight + padding * 2
    );
    
    ctx.fillStyle = 'white';
    ctx.fillText(label, node.x, node.y - scaledSize * 2.5);
  }, [enableBloom]);

  // Enhanced link rendering with better visibility
  const renderLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const strength = link.strength || 0.5;
    const width = Math.max(2, strength * 4); // Increased base width
    
    ctx.save();
    
    // Draw link with glow effect
    if (enableBloom) {
      // Outer glow
      ctx.shadowColor = link.color || '#60a5fa';
      ctx.shadowBlur = width * 3;
      ctx.strokeStyle = link.color || '#60a5fa';
      ctx.lineWidth = width * 1.5;
      ctx.globalAlpha = 0.4 * linkOpacity;
      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.stroke();
      
      // Reset shadow for core line
      ctx.shadowBlur = 0;
    }
    
    // Core link line
    ctx.strokeStyle = link.color || '#60a5fa';
    ctx.lineWidth = width;
    ctx.globalAlpha = linkOpacity;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
    
    // Draw arrowhead for directed links if labels are shown
    if (link.label && showLinkLabels) {
      const angle = Math.atan2(link.target.y - link.source.y, link.target.x - link.source.x);
      const arrowLength = 8;
      const arrowAngle = Math.PI / 6;
      
      const endX = link.target.x - Math.cos(angle) * 15; // Offset from target node
      const endY = link.target.y - Math.sin(angle) * 15;
      
      ctx.fillStyle = link.color || '#60a5fa';
      ctx.globalAlpha = 0.9 * linkOpacity;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle - arrowAngle),
        endY - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle + arrowAngle),
        endY - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.closePath();
      ctx.fill();
    }
    
    // Draw link labels if enabled
    if (link.label && showLinkLabels) {
      const midX = (link.source.x + link.target.x) / 2;
      const midY = (link.source.y + link.target.y) / 2;
      
      ctx.font = '10px Sans-Serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Background for label
      const textMetrics = ctx.measureText(link.label);
      const padding = 4;
      
      ctx.fillStyle = `rgba(0, 0, 0, ${0.8 * linkOpacity})`;
      ctx.fillRect(
        midX - textMetrics.width / 2 - padding,
        midY - 8 - padding,
        textMetrics.width + padding * 2,
        16 + padding * 2
      );
      
      ctx.fillStyle = `rgba(255, 255, 255, ${linkOpacity})`;
      ctx.fillText(link.label, midX, midY);
    }
    
    ctx.restore();
  }, [enableBloom, linkOpacity, showLinkLabels]);

  // Animation loop for bloom effects
  const animate = useCallback(() => {
    if (enableBloom && isInitialized) {
      applyBloomEffect();
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [enableBloom, isInitialized, applyBloomEffect]);

  // Initialize and start animation
  useEffect(() => {
    initializeBloom();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initializeBloom]);

  useEffect(() => {
    if (isInitialized) {
      animate();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized, animate]);

  // Handle canvas reference
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  // Expose graph methods via ref
  useImperativeHandle(ref, () => ({
    zoomToFit: (duration = 800) => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(duration);
      }
    },
    zoom: (scale: number, duration = 800) => {
      if (fgRef.current) {
        fgRef.current.zoom(scale, duration);
      }
    },
    cameraPosition: (position, duration = 800) => {
      if (fgRef.current) {
        fgRef.current.cameraPosition(position, duration);
      }
    },
    centerAt: (position, duration = 800) => {
      if (fgRef.current) {
        fgRef.current.centerAt(position, duration);
      }
    }
  }), []);

  if (!ForceGraph2D) {
    return (
      <div className="flex items-center justify-center h-64 bg-custom-box border-custom-border rounded-lg">
        <div className="text-center">
          <div className="text-fm-light-grey mb-2">Graph visualization failed to load</div>
          <div className="text-xs text-fm-medium-grey">Please refresh the page to try again</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={width}
        height={height}
        nodeCanvasObject={renderNode}
        linkCanvasObject={renderLink}
        nodeLabel="label"
        linkLabel="label"
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        onNodeClick={onNodeClick}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        backgroundColor="transparent"
        onReady={(graph) => {
          // Get the canvas element when graph is ready
          const canvas = graph.canvas();
          if (canvas) {
            handleCanvasReady(canvas);
          }
        }}
      />
      
      {/* Bloom effect indicator */}
      {enableBloom && (
        <div className="absolute top-4 right-4 bg-custom-box border border-custom-border rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-fm-light-grey">Bloom Active</span>
          </div>
        </div>
      )}
    </div>
  );
  }
);

BloomGraph2D.displayName = 'BloomGraph2D';

export default BloomGraph2D;