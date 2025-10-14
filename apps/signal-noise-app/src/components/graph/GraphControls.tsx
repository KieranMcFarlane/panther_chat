'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Grid3x3,
  Target,
  MousePointer,
  Hand,
  Sliders
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface GraphControlsProps {
  fgRef: React.MutableRefObject<any>;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleInteraction: (mode: 'pan' | 'select') => void;
  bloomEnabled: boolean;
  onToggleBloom: () => void;
  onBloomIntensityChange: (value: number) => void;
  bloomIntensity: number;
  linkOpacity: number;
  onLinkOpacityChange: (value: number) => void;
  showLinkLabels: boolean;
  onToggleLinkLabels: () => void;
}

export default function GraphControls({
  fgRef,
  onResetView,
  onZoomIn,
  onZoomOut,
  onToggleInteraction,
  bloomEnabled,
  onToggleBloom,
  onBloomIntensityChange,
  bloomIntensity,
  linkOpacity,
  onLinkOpacityChange,
  showLinkLabels,
  onToggleLinkLabels
}: GraphControlsProps) {
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleInteractionToggle = useCallback(() => {
    const newMode = interactionMode === 'pan' ? 'select' : 'pan';
    setInteractionMode(newMode);
    onToggleInteraction(newMode);
  }, [interactionMode, onToggleInteraction]);

  const handleFullscreen = useCallback(() => {
    const container = document.getElementById('graph-container');
    if (!container) return;

    if (!isFullscreen) {
      container.requestFullscreen?.() || 
      (container as any).webkitRequestFullscreen?.() ||
      (container as any).msRequestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.() ||
      (document as any).webkitExitFullscreen?.() ||
      (document as any).msExitFullscreen?.();
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  const handleFitToScreen = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(800);
    }
  }, [fgRef]);

  const handleCenterGraph = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.centerAt(0, 0, 800);
    }
  }, [fgRef]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <Card className="bg-custom-box border-custom-border">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Basic Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onZoomIn}
              className="border-custom-border text-fm-light-grey hover:bg-custom-bg"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onZoomOut}
              className="border-custom-border text-fm-light-grey hover:bg-custom-bg"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onResetView}
              className="border-custom-border text-fm-light-grey hover:bg-custom-bg"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleFitToScreen}
              className="border-custom-border text-fm-light-grey hover:bg-custom-bg"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCenterGraph}
              className="border-custom-border text-fm-light-grey hover:bg-custom-bg"
            >
              <Target className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-fm-medium-grey mx-1"></div>

            <Button
              variant={interactionMode === 'pan' ? "default" : "outline"}
              size="sm"
              onClick={handleInteractionToggle}
              className={
                interactionMode === 'pan' 
                  ? "bg-yellow-500 text-black hover:bg-yellow-400" 
                  : "border-custom-border text-fm-light-grey hover:bg-custom-bg"
              }
            >
              <Hand className="w-4 h-4" />
            </Button>
            
            <Button
              variant={interactionMode === 'select' ? "default" : "outline"}
              size="sm"
              onClick={handleInteractionToggle}
              className={
                interactionMode === 'select' 
                  ? "bg-blue-500 text-white hover:bg-blue-400" 
                  : "border-custom-border text-fm-light-grey hover:bg-custom-bg"
              }
            >
              <MousePointer className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-fm-medium-grey mx-1"></div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleFullscreen}
              className="border-custom-border text-fm-light-grey hover:bg-custom-bg"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
          </div>

          {/* Advanced Controls Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-fm-light-grey hover:text-white hover:bg-custom-bg"
            >
              <Sliders className="w-4 h-4 mr-2" />
              Advanced
            </Button>
            
            {/* Bloom Toggle */}
            <Button
              variant={bloomEnabled ? "default" : "outline"}
              size="sm"
              onClick={onToggleBloom}
              className={
                bloomEnabled 
                  ? "bg-purple-500 text-white hover:bg-purple-400" 
                  : "border-custom-border text-fm-light-grey hover:bg-custom-bg"
              }
            >
              <div className="w-4 h-4 mr-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-400"></div>
              Bloom
            </Button>
          </div>

          {/* Advanced Controls Panel */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-custom-bg rounded-lg">
              {/* Bloom Intensity Control */}
              {bloomEnabled && (
                <div className="space-y-2">
                  <label className="text-sm text-fm-light-grey font-medium">
                    Bloom Intensity: {bloomIntensity.toFixed(1)}
                  </label>
                  <Slider
                    value={[bloomIntensity]}
                    onValueChange={(value) => onBloomIntensityChange(value[0])}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              )}

              {/* Link Visibility Controls */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-fm-light-grey font-medium">
                    Link Opacity: {linkOpacity.toFixed(1)}
                  </label>
                  <Slider
                    value={[linkOpacity]}
                    onValueChange={(value) => onLinkOpacityChange(value[0])}
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant={showLinkLabels ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleLinkLabels}
                    className={
                      showLinkLabels 
                        ? "bg-green-500 text-white hover:bg-green-400" 
                        : "border-custom-border text-fm-light-grey hover:bg-custom-bg"
                    }
                  >
                    {showLinkLabels ? "Hide Labels" : "Show Labels"}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-xs text-fm-medium-grey space-y-1">
                <p><strong>Navigation:</strong></p>
                <p>• Scroll: Zoom in/out</p>
                <p>• Drag: Pan around (Pan mode)</p>
                <p>• Click nodes: View details (Select mode)</p>
                <p>• Drag nodes: Reposition</p>
                <p>• Double-click: Zoom to node</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}