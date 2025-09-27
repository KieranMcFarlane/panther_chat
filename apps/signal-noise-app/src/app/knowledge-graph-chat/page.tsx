'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function KnowledgeGraphChatPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const chatUrl = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:7681';
  const [terminalCommand, setTerminalCommand] = useState('ttyd -p 7681 ssh -i /home/ec2-user/yellowpanther.pem ec2-user@13.60.60.50');

  useEffect(() => {
    // Check if the external service is accessible
    const checkConnection = async () => {
      try {
        const response = await fetch(chatUrl, { mode: 'no-cors' });
        setConnectionStatus('connected');
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to connect to Knowledge Graph Chat:', error);
        setConnectionStatus('error');
        setIsLoading(false);
      }
    };

    checkConnection();
  }, [chatUrl]);

  // Handle fullscreen mode by adding/removing CSS classes
  useEffect(() => {
    if (isFullscreen) {
      // Add fullscreen styles to override layout padding/margin
      document.body.style.overflow = 'hidden';
      // Add custom CSS to override the layout classes
      const style = document.createElement('style');
      style.id = 'fullscreen-override';
      style.textContent = `
        .fullscreen-override .p-6.ml-64,
        .fullscreen-override .p-6.ml-16 {
          padding: 0 !important;
          margin-left: 0 !important;
        }
        .fullscreen-override .max-w-7xl {
          max-width: none !important;
          width: 100% !important;
          height: 100vh !important;
        }
        .fullscreen-override .bg-custom-box.border-b.border-custom-border.sticky.top-0.z-20 {
          display: none !important;
        }
        .fullscreen-override .w-64.bg-custom-box.border-r.border-custom-border.h-screen.fixed.left-0.top-0.z-10 {
          display: none !important;
        }
        .fullscreen-override .w-16.bg-custom-box.border-r.border-custom-border.h-screen.fixed.left-0.top-0.z-10 {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
      document.body.classList.add('fullscreen-override');
    } else {
      // Remove fullscreen styles
      document.body.style.overflow = '';
      const style = document.getElementById('fullscreen-override');
      if (style) {
        style.remove();
      }
      document.body.classList.remove('fullscreen-override');
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      const style = document.getElementById('fullscreen-override');
      if (style) {
        style.remove();
      }
      document.body.classList.remove('fullscreen-override');
    };
  }, [isFullscreen]);

  const handleRefresh = () => {
    setIsLoading(true);
    setConnectionStatus('connecting');
    setIframeKey(prev => prev + 1);
    
    // Simulate connection check
    setTimeout(() => {
      setConnectionStatus('connected');
      setIsLoading(false);
    }, 1000);
  };

  const startTerminal = async () => {
    setIsLoading(true);
    setConnectionStatus('connecting');
    
    try {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setConnectionStatus('connected');
        // Update the iframe URL with the terminal
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      } else {
        setConnectionStatus('error');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to start terminal:', error);
      setConnectionStatus('error');
      setIsLoading(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`min-h-screen bg-custom-bg ${isFullscreen ? 'p-0' : 'p-6'}`}>
      <div className={`mx-auto ${isFullscreen ? 'w-full h-screen' : 'max-w-7xl'}`}>
        {/* Header */}
        <div className={`${isFullscreen ? 'hidden' : 'mb-6'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-header-large text-fm-white mb-2">Knowledge Graph Chat</h1>
              <p className="font-body-primary text-fm-light-grey">
                Interactive chat interface for querying the Neo4j knowledge graph
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={startTerminal}
                variant="outline"
                size="sm"
                className="border-custom-border text-fm-light-grey hover:bg-custom-border bg-custom-box"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Start Terminal
              </Button>
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                className="border-custom-border text-fm-light-grey hover:bg-custom-border bg-custom-box"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={toggleFullscreen}
                variant="outline"
                size="sm"
                className="border-custom-border text-fm-light-grey hover:bg-custom-border bg-custom-box"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Exit Fullscreen
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Fullscreen
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <Card className={`bg-custom-box border-custom-border ${isFullscreen ? 'h-screen border-0 rounded-none' : ''}`}>
          <CardHeader className={isFullscreen ? 'hidden' : ''}>
            <CardTitle className="font-subheader text-fm-white">Chat Interface</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className={`relative ${isFullscreen ? 'h-screen' : 'h-[600px]'}`}>
              <iframe
                key={iframeKey}
                src={chatUrl}
                className="w-full h-full border-0 rounded-md"
                title="Knowledge Graph Chat Interface"
                onLoad={() => setIsLoading(false)}
                onError={() => setConnectionStatus('error')}
              />
              {isLoading && (
                <div className="absolute inset-0 bg-custom-box flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fm-yellow mx-auto mb-4"></div>
                    <p className="font-body-primary text-fm-light-grey">Connecting to Knowledge Graph Chat...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instructions - Hidden in fullscreen */}
        <div className={`mt-6 ${isFullscreen ? 'hidden' : ''}`}>
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-subheader text-fm-white">EC2 Terminal Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Connection Status */}
                <div className="bg-custom-bg border border-custom-border rounded-lg p-4">
                  <h4 className="font-body-medium text-fm-white mb-2">Connection Status</h4>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-500' : 
                      connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-fm-light-grey">
                      {connectionStatus === 'connected' ? 'Connected to EC2 Terminal' :
                       connectionStatus === 'connecting' ? 'Connecting...' : 'Not Connected'}
                    </span>
                  </div>
                </div>

                {/* Manual Setup Instructions */}
                <div>
                  <h4 className="font-body-medium text-fm-white mb-3">Manual Terminal Setup</h4>
                  <div className="bg-custom-bg border border-custom-border rounded-lg p-4">
                    <p className="font-body-secondary text-fm-medium-grey mb-3">
                      If the automatic start doesn't work, run this command in your terminal:
                    </p>
                    <code className="block bg-custom-border text-fm-light-grey p-3 rounded text-sm font-mono">
                      ./start-terminal.sh
                    </code>
                  </div>
                </div>

                {/* EC2 Connection Details */}
                <div>
                  <h4 className="font-body-medium text-fm-white mb-3">EC2 Connection Info</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-fm-medium-grey">Host:</span>
                      <span className="text-fm-light-grey ml-2">13.60.60.50</span>
                    </div>
                    <div>
                      <span className="text-fm-medium-grey">User:</span>
                      <span className="text-fm-light-grey ml-2">ec2-user</span>
                    </div>
                    <div>
                      <span className="text-fm-medium-grey">Port:</span>
                      <span className="text-fm-light-grey ml-2">7681</span>
                    </div>
                    <div>
                      <span className="text-fm-medium-grey">Key:</span>
                      <span className="text-fm-light-grey ml-2">yellowpanther.pem</span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="font-body-medium text-fm-white mb-3">Terminal Features</h4>
                  <ul className="space-y-2 font-body-secondary text-fm-medium-grey">
                    <li>• Full SSH access to your EC2 instance</li>
                    <li>• Browser-based terminal interface</li>
                    <li>• Dark theme optimized for development</li>
                    <li>• Direct Neo4j database access</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
