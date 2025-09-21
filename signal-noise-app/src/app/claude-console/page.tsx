'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClaudeConsolePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const chatUrl = process.env.NEXT_PUBLIC_CLAUDE_CONSOLE_URL || 'http://localhost:5173';

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await fetch(chatUrl, { mode: 'no-cors' });
        setConnectionStatus('connected');
        setIsLoading(false);
      } catch {
        setConnectionStatus('error');
        setIsLoading(false);
      }
    };
    checkConnection();
  }, [chatUrl]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      const style = document.createElement('style');
      style.id = 'fullscreen-override';
      style.textContent = `
        .fullscreen-override .p-6.ml-64,
        .fullscreen-override .p-6.ml-16 { padding: 0 !important; margin-left: 0 !important; }
        .fullscreen-override .max-w-7xl { max-width: none !important; width: 100% !important; height: 100vh !important; }
        .fullscreen-override .bg-custom-box.border-b.border-custom-border.sticky.top-0.z-20 { display: none !important; }
        .fullscreen-override .w-64.bg-custom-box.border-r.border-custom-border.h-screen.fixed.left-0.top-0.z-10 { display: none !important; }
        .fullscreen-override .w-16.bg-custom-box.border-r.border-custom-border.h-screen.fixed.left-0.top-0.z-10 { display: none !important; }
      `;
      document.head.appendChild(style);
      document.body.classList.add('fullscreen-override');
    } else {
      document.body.style.overflow = '';
      const style = document.getElementById('fullscreen-override');
      if (style) style.remove();
      document.body.classList.remove('fullscreen-override');
    }
    return () => {
      document.body.style.overflow = '';
      const style = document.getElementById('fullscreen-override');
      if (style) style.remove();
      document.body.classList.remove('fullscreen-override');
    };
  }, [isFullscreen]);

  const handleRefresh = () => {
    setIsLoading(true);
    setConnectionStatus('connecting');
    setIframeKey(prev => prev + 1);
    setTimeout(() => {
      setConnectionStatus('connected');
      setIsLoading(false);
    }, 800);
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  return (
    <div className={`min-h-screen bg-custom-bg ${isFullscreen ? 'p-0' : 'p-6'}`}>
      <div className={`mx-auto ${isFullscreen ? 'w-full h-screen' : 'max-w-7xl'}`}>
        <div className={`${isFullscreen ? 'hidden' : 'mb-6'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-header-large text-fm-white mb-2">Claude Console</h1>
              <p className="font-body-primary text-fm-light-grey">Embedded Claude Code UI console</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleRefresh} variant="outline" size="sm" className="border-custom-border text-fm-light-grey hover:bg-custom-border bg-custom-box">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={toggleFullscreen} variant="outline" size="sm" className="border-custom-border text-fm-light-grey hover:bg-custom-border bg-custom-box">
                {isFullscreen ? (<><Minimize2 className="h-4 w-4 mr-2" />Exit Fullscreen</>) : (<><Maximize2 className="h-4 w-4 mr-2" />Fullscreen</>)}
              </Button>
            </div>
          </div>
        </div>

        <Card className={`bg-custom-box border-custom-border ${isFullscreen ? 'h-screen border-0 rounded-none' : ''}`}>
          <CardHeader className={isFullscreen ? 'hidden' : ''}>
            <CardTitle className="font-subheader text-fm-white">Console</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className={`relative ${isFullscreen ? 'h-screen' : 'h-[600px]'}`}>
              <iframe
                key={iframeKey}
                src={chatUrl}
                className="w-full h-full border-0 rounded-md"
                title="Claude Console"
                onLoad={() => setIsLoading(false)}
                onError={() => setConnectionStatus('error')}
              />
              {isLoading && (
                <div className="absolute inset-0 bg-custom-box flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fm-yellow mx-auto mb-4"></div>
                    <p className="font-body-primary text-fm-light-grey">Connecting to Claude Console...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className={`mt-6 ${isFullscreen ? 'hidden' : ''}`}>
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-subheader text-fm-white">Config</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-body-secondary text-fm-medium-grey">Using URL: <span className="text-fm-light-grey">{chatUrl}</span></p>
              <p className="font-body-secondary text-fm-medium-grey mt-2">Set <code className="text-fm-light-grey">NEXT_PUBLIC_CLAUDE_CONSOLE_URL</code> to override.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


