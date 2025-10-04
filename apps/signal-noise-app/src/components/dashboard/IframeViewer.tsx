'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface Slot {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error' | 'creating';
  authProvider: string;
  createdAt: Date;
  lastActivity: Date;
  cpuUsage: number;
  memoryUsage: number;
}

interface UserSession {
  id: string;
  userId: string;
  email: string;
  isActive: boolean;
  expiresAt: Date;
  authProvider: string;
}

interface IframeViewerProps {
  slot: Slot;
  userSession: UserSession | null;
}

export default function IframeViewer({ slot, userSession }: IframeViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate iframe URL using the iframe integration service
  useEffect(() => {
    const generateIframeUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!userSession) {
          throw new Error('User session not available');
        }

        // Simulate calling the iframe integration service
        // In a real implementation, this would call the actual service
        const baseUrl = 'http://localhost:7681';
        const timestamp = Date.now();
        const signature = `mock-signature-${slot.id}-${timestamp}`;
        
        const url = `${baseUrl}/slot/${slot.id}?ts=${timestamp}&sig=${signature}&theme=dark&width=100%&height=100%`;
        
        setIframeUrl(url);
        
        // Simulate API delay
        setTimeout(() => setLoading(false), 1000);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate iframe URL');
        setLoading(false);
      }
    };

    generateIframeUrl();
  }, [slot, userSession]);

  const handleIframeLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError('Failed to load iframe content. Please check if the ClaudeBox service is running.');
  };

  const refreshIframe = () => {
    setLoading(true);
    setError(null);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      const elem = iframeRef.current;
      if (elem?.requestFullscreen) {
        elem.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle cross-origin messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin for security
      if (event.origin !== 'http://localhost:7681') {
        return;
      }

      const { type, sessionId, payload } = event.data;

      switch (type) {
        case 'iframe_ready':
          console.log('Iframe ready:', payload);
          break;
        case 'user_activity':
          console.log('User activity in iframe:', payload);
          break;
        case 'auth_request':
          console.log('Auth request from iframe:', payload);
          // Handle authentication request
          break;
        default:
          console.log('Received message from iframe:', type, payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-custom-bg">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-custom-box bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-yellow-500" />
            <p className="text-slate-300">Loading ClaudeBox terminal...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-custom-box bg-opacity-95 flex items-center justify-center z-10">
          <div className="max-w-md w-full p-6">
            <Alert className="border-red-500 bg-red-500 bg-opacity-10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-300">
                {error instanceof Error ? error.message : String(error)}
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex gap-2">
              <Button onClick={refreshIframe} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button variant="outline" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Iframe Header */}
      <div className="bg-custom-box border-b border-custom-border p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-green-400 border-green-400">
            <CheckCircle className="w-3 h-3 mr-1" />
            {slot.status}
          </Badge>
          <Badge variant="outline" className="text-yellow-400 border-yellow-400">
            {slot.authProvider}
          </Badge>
          <span className="text-sm text-slate-400">
            {slot.name}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={refreshIframe}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Iframe Container */}
      <div className="relative w-full h-full">
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className="w-full h-full border-0 bg-custom-bg"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          allow="clipboard-read; clipboard-write; fullscreen; presentation; screen-orientation"
          title={`ClaudeBox Terminal - ${slot.name}`}
        />
      </div>

      {/* Connection Status */}
      <div className="absolute bottom-4 right-4">
        <Card className="bg-custom-box border-custom-border p-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-300">Connected to ClaudeBox</span>
          </div>
        </Card>
      </div>
    </div>
  );
}