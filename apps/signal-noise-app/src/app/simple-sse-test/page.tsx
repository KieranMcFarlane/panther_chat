'use client';

import { useState, useEffect } from 'react';

export default function SimpleSSETest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };

  useEffect(() => {
    addLog('🧪 Starting Simple SSE Test - Real Entity Processing');
    
    // Use a unique timestamp to prevent caching issues
    const timestamp = Date.now();
    const eventSource = new EventSource(
      `/api/claude-agent-demo/stream?service=reliable&query=Test&mode=batch&entityLimit=2&t=${timestamp}`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
      addLog('✅ SSE connection opened - REAL PROCESSING STARTED');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Look specifically for the REAL entity search events
        if (data.type === 'entity_search_start') {
          addLog(`🔍 REAL ENTITY SEARCH: ${data.message}`);
        } else if (data.type === 'entity_search_complete') {
          addLog(`✅ REAL ENTITY COMPLETE: ${data.message}`);
        } else if (data.type === 'progress' && data.message?.includes('Starting BrightData search')) {
          addLog(`🔍 REAL BRIGHTDATA SEARCH: ${data.message}`);
        } else if (data.type === 'progress' && data.message?.includes('BrightData search completed')) {
          addLog(`✅ REAL BRIGHTDATA COMPLETE: ${data.message}`);
        } else if (data.type === 'heartbeat') {
          // Only log heartbeats every 30 seconds to reduce noise
          const seconds = parseInt(data.progress?.toString() || '0') * 60;
          if (seconds % 30 === 0) {
            addLog(`💓 Connection alive: ${data.progress || 'processing'}`);
          }
        }
      } catch (error) {
        addLog(`❌ Parse error: ${error}`);
      }
    };

    eventSource.addEventListener('result', (event) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`🏁 REAL RESULTS RECEIVED: Found ${data.data?.totalFound || 0} RFP opportunities`);
        eventSource.close();
        setIsConnected(false);
      } catch (error) {
        addLog(`🏁 Final result received`);
        eventSource.close();
        setIsConnected(false);
      }
    });

    eventSource.onerror = (error) => {
      addLog(`❌ SSE Error: Connection lost - ${error || 'Unknown error'}`);
      setIsConnected(false);
      console.error('SSE Error details:', error);
      
      // Don't immediately close - let browser handle reconnection
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          addLog('🔌 Connection closed permanently');
          eventSource.close();
        }
      }, 1000);
    };

    // Auto-close after 2 minutes
    const timeout = setTimeout(() => {
      if (eventSource.readyState !== 2) {
        addLog('⏰ Test timeout - closing connection');
        eventSource.close();
        setIsConnected(false);
      }
    }, 120000);

    return () => {
      clearTimeout(timeout);
      if (eventSource.readyState !== 2) {
        eventSource.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono text-sm">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-green-300">
          🔥 REAL SSE ENTITY PROCESSING TEST
        </h1>
        <p className="text-green-500 mb-6">
          This shows REAL entity processing with BrightData API - NOT MOCK DATA
        </p>

        <div className="mb-4">
          <div className={`inline-block px-4 py-2 rounded ${
            isConnected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}>
            Status: {isConnected ? '🟢 CONNECTED - REAL PROCESSING' : '🔴 DISCONNECTED'}
          </div>
        </div>

        <div className="bg-black border border-green-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 text-green-300">Live Entity Processing Events</h2>
          <div className="bg-gray-900 rounded p-4 h-96 overflow-y-auto text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-500">Starting real entity processing...</div>
            ) : (
              logs.map((log, index) => (
                <div 
                  key={index} 
                  className={
                    log.includes('REAL ENTITY SEARCH') || log.includes('REAL BRIGHTDATA SEARCH') ? 'text-blue-400 font-bold' :
                    log.includes('REAL ENTITY COMPLETE') || log.includes('REAL BRIGHTDATA COMPLETE') ? 'text-green-400 font-bold' :
                    log.includes('ERROR') || log.includes('❌') ? 'text-red-400' :
                    log.includes('✅') ? 'text-green-400' :
                    log.includes('🔍') ? 'text-blue-400' :
                    'text-gray-400'
                  }
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-gray-900 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2 text-green-300">What You're Seeing:</h3>
          <div className="text-sm text-gray-400 space-y-1">
            <div>🔍 <strong>REAL BrightData API searches</strong> for sports entities</div>
            <div>✅ <strong>REAL search completion</strong> with actual results</div>
            <div>🏁 <strong>REAL RFP intelligence analysis</strong> using Claude AI</div>
            <div>💚 <strong>NOT MOCK DATA</strong> - This is the actual production system</div>
          </div>
        </div>
      </div>
    </div>
  );
}