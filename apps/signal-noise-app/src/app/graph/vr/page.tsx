'use client';

import { useState, useEffect, useRef } from 'react';
import { Monitor, RotateCcw, AlertCircle, Glasses } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function VRGraphPage() {
  const [isVRSupported, setIsVRSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for WebXR VR support
    if ('xr' in navigator) {
      (navigator as any).xr?.isSessionSupported('immersive-vr').then((supported: boolean) => {
        setIsVRSupported(supported);
      });
    }
  }, []);

  const handleEnterVR = async () => {
    if (!isVRSupported) {
      setError('VR is not supported on this device. Please use a VR-compatible browser and headset.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Initialize WebXR VR session
      const session = await (navigator as any).xr?.requestSession('immersive-vr', {
        requiredFeatures: ['local', 'hit-test'],
        optionalFeatures: ['anchors', 'planes', 'depth-sensing']
      });

      if (session) {
        // Initialize VR rendering context
        // This would integrate with Three.js or similar for VR rendering
        console.log('VR session started:', session);
        
        // For now, show placeholder message
        setError('VR mode is coming soon! This will provide an immersive 3D experience of your knowledge graph.');
        
        // End session after demo
        await session.end();
      }
    } catch (err: any) {
      setError(`VR session failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Glasses className="w-8 h-8 text-yellow-400" />
            VR Knowledge Graph
          </h1>
          <p className="text-fm-light-grey">Immersive 3D visualization of entity relationships</p>
        </div>
        <Button 
          onClick={handleEnterVR}
          disabled={!isVRSupported || isLoading}
          className="bg-yellow-500 text-black hover:bg-yellow-400"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
              Initializing...
            </>
          ) : (
            <>
              <Glasses className="w-4 h-4 mr-2" />
              Enter VR
            </>
          )}
        </Button>
      </div>

      {/* VR Status Card */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            VR Compatibility Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-fm-light-grey">WebXR Support:</span>
              <Badge variant={isVRSupported ? "default" : "destructive"}>
                {isVRSupported ? "Supported" : "Not Supported"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-fm-light-grey">Browser Compatibility:</span>
              <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                Chrome/Firefox Required
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-fm-light-grey">Hardware Required:</span>
              <Badge variant="outline" className="text-blue-400 border-blue-400">
                VR Headset
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* VR Features */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white">VR Experience Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Interactive Controls</h3>
              <ul className="space-y-2 text-fm-light-grey">
                <li>🎮 Hand controller support for node manipulation</li>
                <li>👊 Gesture-based node selection and editing</li>
                <li>🚀 Smooth navigation through the knowledge graph</li>
                <li>🔄 Real-time graph updates and animations</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">3D Visualization</h3>
              <ul className="space-y-2 text-fm-light-grey">
                <li>🌐 Spatial representation of entity relationships</li>
                <li>📊 Dynamic clustering and grouping</li>
                <li>🎨 Customizable visual themes and layouts</li>
                <li>📏 Real-world scale representation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Roadmap */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white">Implementation Roadmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">✓</div>
              <div>
                <div className="text-white font-medium">WebXR Integration</div>
                <div className="text-fm-light-grey text-sm">Basic VR session management</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black text-sm font-bold">~</div>
              <div>
                <div className="text-white font-medium">3D Graph Rendering</div>
                <div className="text-fm-light-grey text-sm">Three.js integration for spatial graphs</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-sm font-bold">○</div>
              <div>
                <div className="text-white font-medium">Hand Tracking</div>
                <div className="text-fm-light-grey text-sm">Advanced hand controller support</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-sm font-bold">○</div>
              <div>
                <div className="text-white font-medium">Multi-user Collaboration</div>
                <div className="text-fm-light-grey text-sm">Shared VR spaces for team analysis</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white">Getting Started with VR</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-fm-light-grey">
            <p>
              To experience the VR knowledge graph visualization, you'll need:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>A VR-compatible browser (Chrome, Firefox, or Edge)</li>
              <li>A connected VR headset (Oculus Quest, HTC Vive, etc.)</li>
              <li>Enabled WebXR API in your browser settings</li>
              <li>Adequate space for VR interaction</li>
            </ol>
            
            <div className="mt-6 p-4 bg-custom-bg rounded-lg">
              <p className="text-sm text-yellow-400">
                <strong>Pro Tip:</strong> Start with the 2D graph to familiarize yourself with the data structure before entering VR mode.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}