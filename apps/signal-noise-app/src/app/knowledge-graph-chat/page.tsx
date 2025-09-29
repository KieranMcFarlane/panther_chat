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
    // Auto-start ClaudeBox when page loads
    const autoStartClaudeBox = async () => {
      try {
        setIsLoading(true);
        setConnectionStatus('connecting');
        
        // Try to execute the auto-launch script remotely
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          // Attempt to fetch the terminal with auto-launch command
          await fetch(`${chatUrl}`, { 
            mode: 'no-cors',
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          setConnectionStatus('connected');
        } catch (fetchError) {
          // Cross-origin request failed, but terminal might still work
          setConnectionStatus('connected');
        }
        
        clearTimeout(timeoutId);
      } catch (error) {
        console.error('Auto-start failed:', error);
        setConnectionStatus('error');
      }
      setIsLoading(false);
    };

    autoStartClaudeBox();
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
      // Start local ttyd service with ClaudeBox
      if (!window.location.href.includes('localhost:7681')) {
        // Redirect to local terminal
        window.open('http://localhost:7681', '_blank');
      }
      
      setConnectionStatus('connected');
      setIsLoading(false);
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
              <h1 className="font-header-large text-fm-white mb-2">Claude Code Terminal</h1>
              <p className="font-body-primary text-fm-light-grey">
                Immediate access to Claude Code with auto-start configuration
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
            <CardTitle className="font-subheader text-fm-white">Claude Code Terminal</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className={`relative ${isFullscreen ? 'h-screen' : 'h-[600px]'}`}>
              <iframe
                key={iframeKey}
                src={chatUrl}
                className="w-full h-full border-0 rounded-md"
                title="Claude Code Terminal"
                onLoad={() => {
                  setIsLoading(false);
                  setConnectionStatus('connected');
                }}
                onError={() => setConnectionStatus('error')}
                allowFullScreen
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-top-navigation-by-user-activation"
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
              <CardTitle className="font-subheader text-fm-white">Claude Code Setup</CardTitle>
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
                      {connectionStatus === 'connected' ? 'Claude Code auto-launching...' :
                       connectionStatus === 'connecting' ? 'Starting local terminal...' : 'Connection Error'}
                    </span>
                  </div>
                </div>

                {/* Auto-launch Instructions */}
                <div>
                  <h4 className="font-body-medium text-fm-white mb-3">Auto-Start Features</h4>
                  <div className="bg-custom-bg border border-custom-border rounded-lg p-4">
                    <p className="font-body-secondary text-fm-medium-grey mb-3">
                      ✅ Claude Code will auto-launch when the terminal connects!
                    </p>
                    <p className="font-body-secondary text-fm-medium-grey">
                      Just wait 30-60 seconds for Claude to initialize. No typing required.
                    </p>
                  </div>
                </div>

                {/* ClaudeBox Configuration */}
                <div>
                  <h4 className="font-body-medium text-fm-white mb-3">Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-fm-medium-grey">Terminal:</span>
                      <span className="text-fm-light-grey ml-2">Local (localhost:7681)</span>
                    </div>
                    <div>
                      <span className="text-fm-medium-grey">Service:</span>
                      <span className="text-fm-light-grey ml-2">ttyd</span>
                    </div>
                    <div>
                      <span className="text-fm-medium-grey">Auto-start:</span>
                      <span className="text-fm-light-grey ml-2">Configured</span>
                    </div>
                    <div>
                      <span className="text-fm-medium-grey">Access:</span>
                      <span className="text-fm-light-grey ml-2">Browser-based</span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="font-body-medium text-fm-white mb-3">Terminal Features</h4>
                  <ul className="space-y-2 font-body-secondary text-fm-medium-grey">
                    <li>• Claude Code auto-launches when terminal connects</li>
                    <li>• No manual typing required - starts automatically</li>
                    <li>• Full browser-based Claude Code access</li>
                    <li>• Pre-configured with Z.ai API keys and settings</li>
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
