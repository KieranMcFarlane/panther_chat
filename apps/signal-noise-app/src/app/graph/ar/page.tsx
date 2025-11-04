'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, RotateCcw, AlertCircle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ARGraphPage() {
  const [isARSupported, setIsARSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    // Check for WebXR AR support
    if ('xr' in navigator) {
      (navigator as any).xr?.isSessionSupported('immersive-ar').then((supported: boolean) => {
        setIsARSupported(supported);
      });
    }
  }, []);

  const handleEnterAR = async () => {
    if (!isARSupported) {
      setError('AR is not supported on this device. Please use a mobile device with AR capabilities.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCameraActive(true);

    try {
      // Initialize WebXR AR session
      const session = await (navigator as any).xr?.requestSession('immersive-ar', {
        requiredFeatures: ['local', 'hit-test'],
        optionalFeatures: ['anchors', 'planes', 'depth-sensing']
      });

      if (session) {
        // Initialize AR rendering context
        // This would integrate with Three.js or similar for AR rendering
        console.log('AR session started:', session);
        
        // For now, show placeholder message
        setError('AR mode is coming soon! This will overlay knowledge graphs onto your real environment.');
        
        // End session after demo
        await session.end();
      }
    } catch (err: any) {
      setError(`AR session failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setCameraActive(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Eye className="w-8 h-8 text-purple-400" />
            AR Knowledge Graph
          </h1>
          <p className="text-fm-light-grey">Augmented reality overlay of entity relationships</p>
        </div>
        <Button 
          onClick={handleEnterAR}
          disabled={!isARSupported || isLoading}
          className="bg-purple-500 text-white hover:bg-purple-400"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Initializing...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Start AR
            </>
          )}
        </Button>
      </div>

      {/* AR Status Card */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Camera className="w-5 h-5" />
            AR Compatibility Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-fm-light-grey">WebXR AR Support:</span>
              <Badge variant={isARSupported ? "default" : "destructive"}>
                {isARSupported ? "Supported" : "Not Supported"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-fm-light-grey">Device Type:</span>
              <Badge variant="outline" className="text-green-400 border-green-400">
                Mobile Required
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-fm-light-grey">Camera Access:</span>
              <Badge variant={cameraActive ? "default" : "outline"} className={cameraActive ? "bg-green-500" : "text-gray-400 border-gray-400"}>
                {cameraActive ? "Active" : "Inactive"}
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

      {/* AR Features */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white">AR Experience Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Environmental Interaction</h3>
              <ul className="space-y-2 text-fm-light-grey">
                <li>🗺️ Real-world surface detection and anchoring</li>
                <li>📍 Place knowledge graphs in physical space</li>
                <li>📏 Accurate spatial mapping and scaling</li>
                <li>🔄 Dynamic repositioning and adjustment</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Visual Overlay</h3>
              <ul className="space-y-2 text-fm-light-grey">
                <li>🎯 Contextual entity information display</li>
                <li>🔗 Interactive relationship visualization</li>
                <li>👆 Touch and gesture controls</li>
                <li>🌐 Real-time data integration</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Use Cases */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white">AR Use Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-custom-bg rounded-lg">
              <h3 className="text-white font-semibold mb-2">🏢 Office Planning</h3>
              <p className="text-fm-light-grey text-sm">
                Visualize organizational relationships in your actual workspace
              </p>
            </div>
            
            <div className="p-4 bg-custom-bg rounded-lg">
              <h3 className="text-white font-semibold mb-2">🎭 Event Analysis</h3>
              <p className="text-fm-light-grey text-sm">
                Overlay sports intelligence data during live events
              </p>
            </div>
            
            <div className="p-4 bg-custom-bg rounded-lg">
              <h3 className="text-white font-semibold mb-2">🤝 Team Meetings</h3>
              <p className="text-fm-light-grey text-sm">
                Collaborative analysis with shared AR visualizations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Demo */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white">AR Demo Simulation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-custom-bg rounded-lg p-8 text-center">
            {cameraActive ? (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-purple-500 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <p className="text-white">Camera preview would appear here</p>
                <p className="text-fm-light-grey text-sm">
                  AR overlays would be rendered on top of your camera feed
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Eye className="w-16 h-16 mx-auto text-purple-400" />
                <p className="text-white">AR Preview</p>
                <p className="text-fm-light-grey text-sm">
                  Click "Start AR" to enable camera and begin AR experience
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Technical Requirements */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-xl text-white">Technical Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-fm-light-grey">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-white font-semibold mb-2">Hardware Requirements</h3>
                <ul className="space-y-1 text-sm">
                  <li>• iOS device with ARKit support (iPhone 6s+)</li>
                  <li>• Android device with ARCore support</li>
                  <li>• Gyroscope and accelerometer</li>
                  <li>• Camera with depth sensing (preferred)</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-semibold mb-2">Software Requirements</h3>
                <ul className="space-y-1 text-sm">
                  <li>• iOS Safari 12+ or Chrome for Android</li>
                  <li>• WebXR API enabled</li>
                  <li>• HTTPS connection required</li>
                  <li>• Recent browser version</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-custom-bg rounded-lg">
              <p className="text-sm text-purple-400">
                <strong>Development Status:</strong> AR functionality is planned for Q2 2025. Current implementation focuses on 2D graph visualization with AR architecture in place.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}