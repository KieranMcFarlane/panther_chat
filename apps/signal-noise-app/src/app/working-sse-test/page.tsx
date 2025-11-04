'use client';

import { useState, useEffect, useRef } from 'react';

export default function WorkingSSETest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-20), formattedMessage]); // Keep last 20 logs
    console.log(formattedMessage);
  };

  const startTest = () => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    setLogs([]);
    setStatus('connecting');
    addLog('🚀 Starting REAL Entity Processing Test');
    
    try {
      const eventSource = new EventSource(
        '/api/claude-agent-demo/stream?service=reliable&query=Test&mode=batch&entityLimit=2'
      );
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setStatus('connected');
        addLog('✅ CONNECTED - Real BrightData processing starting');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log ALL events for debugging
          console.log('📨 Event received:', { type: data.type, message: data.message?.substring(0, 50) });
          
          // Handle specific events we care about
          if (data.type === 'entity_search_start') {
            addLog(`🔍 ENTITY SEARCH START: ${data.message}`);
          } else if (data.type === 'entity_search_complete') {
            addLog(`✅ ENTITY SEARCH COMPLETE: ${data.message}`);
          } else if (data.type === 'entity_search_error') {
            addLog(`❌ ENTITY SEARCH ERROR: ${data.message}`);
          } else if (data.type === 'progress') {
            addLog(`📋 ${data.message}`);
          } else if (data.type === 'heartbeat') {
            // Only log heartbeats every 30 seconds to reduce noise
            const progress = parseFloat(data.progress?.toString() || '0');
            if (Math.floor(progress * 10) % 3 === 0) { // Log every ~30 seconds
              addLog(`💓 Connection alive: ${progress.toFixed(1)}min`);
            }
          } else if (data.type === 'result') {
            addLog(`🎯 RESULTS: Found ${data.data?.totalFound || 0} RFP opportunities`);
            addLog(`🏁 REAL PROCESSING COMPLETE!`);
            setStatus('completed');
            eventSource.close();
          } else {
            // Log any other event types for debugging
            addLog(`📋 [${data.type}] ${data.message}`);
          }
        } catch (error) {
          addLog(`❌ Parse error: ${error}`);
        }
      };

      // Add specific event listeners for entity search events
      eventSource.addEventListener('entity_search_start', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`🔍 ENTITY SEARCH START: ${data.message}`);
          console.log('✅ Received entity_search_start event:', data);
        } catch (error) {
          addLog(`❌ Parse error in entity_search_start: ${error}`);
        }
      });

      eventSource.addEventListener('entity_search_complete', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`✅ ENTITY SEARCH COMPLETE: ${data.message}`);
          console.log('✅ Received entity_search_complete event:', data);
        } catch (error) {
          addLog(`❌ Parse error in entity_search_complete: ${error}`);
        }
      });

      eventSource.addEventListener('entity_search_error', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`❌ ENTITY SEARCH ERROR: ${data.message}`);
          console.log('✅ Received entity_search_error event:', data);
        } catch (error) {
          addLog(`❌ Parse error in entity_search_error: ${error}`);
        }
      });

      eventSource.addEventListener('result', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`🏁 FINAL RESULT: ${data.data?.totalFound || 0} opportunities found`);
          setStatus('completed');
          eventSource.close();
        } catch (error) {
          addLog(`🏁 Final result received`);
          setStatus('completed');
          eventSource.close();
        }
      });

      eventSource.onerror = (error) => {
        setStatus('error');
        addLog(`❌ CONNECTION ERROR: ${error || 'Unknown error'}`);
        console.error('SSE Error:', error);
        
        setTimeout(() => {
          if (eventSource.readyState === EventSource.CLOSED) {
            addLog('🔌 Connection closed');
            setStatus('disconnected');
          }
        }, 2000);
      };

      // Auto-timeout after 3 minutes
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          addLog('⏰ Auto-timeout - closing connection');
          eventSource.close();
          setStatus('timeout');
        }
      }, 180000);

    } catch (error) {
      setStatus('error');
      addLog(`❌ SETUP ERROR: ${error}`);
    }
  };

  const stopTest = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('stopped');
    addLog('🛑 Test stopped by user');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-green-400 mb-2">
            🔥 WORKING SSE REAL ENTITY TEST
          </h1>
          <p className="text-gray-400">
            This page shows REAL BrightData API processing - NOT mock data
          </p>
        </div>

        {/* Control Panel */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={startTest}
                disabled={status === 'connected' || status === 'connecting'}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-2 rounded font-semibold"
              >
                {status === 'connecting' ? '🔄 Connecting...' : '🚀 Start Real Test'}
              </button>
              
              <button
                onClick={stopTest}
                disabled={status === 'disconnected' || status === 'stopped'}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-6 py-2 rounded font-semibold"
              >
                🛑 Stop
              </button>
              
              <button
                onClick={() => setLogs([])}
                className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded font-semibold"
              >
                🗑️ Clear Logs
              </button>
            </div>
            
            <div className={`px-4 py-2 rounded font-semibold ${
              status === 'connected' ? 'bg-green-600 text-white' :
              status === 'connecting' ? 'bg-yellow-600 text-white' :
              status === 'completed' ? 'bg-blue-600 text-white' :
              status === 'error' ? 'bg-red-600 text-white' :
              'bg-gray-600 text-gray-300'
            }`}>
              Status: {status.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-black rounded-lg p-4 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-green-400">Live Event Stream</h2>
          <div className="bg-gray-900 rounded p-4 h-96 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Click "Start Real Test" to begin REAL entity processing with BrightData API
              </div>
            ) : (
              logs.map((log, index) => {
                let colorClass = 'text-gray-300';
                if (log.includes('✅ ENTITY SEARCH COMPLETE') || log.includes('✅ BRIGHTDATA COMPLETE')) {
                  colorClass = 'text-green-400 font-bold';
                } else if (log.includes('🔍 ENTITY SEARCH START') || log.includes('🔍 BRIGHTDATA SEARCH')) {
                  colorClass = 'text-blue-400 font-bold';
                } else if (log.includes('✅ CONNECTED')) {
                  colorClass = 'text-green-400';
                } else if (log.includes('❌')) {
                  colorClass = 'text-red-400';
                } else if (log.includes('🎯 RESULTS')) {
                  colorClass = 'text-yellow-400 font-bold';
                } else if (log.includes('🏁 REAL PROCESSING COMPLETE')) {
                  colorClass = 'text-purple-400 font-bold';
                }
                
                return (
                  <div key={index} className={colorClass}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4 text-sm text-gray-400">
          <h3 className="text-lg font-semibold text-green-400 mb-2">What You'll See:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="font-semibold text-blue-400">🔍 Real Entity Searches:</div>
              <div>• Neo4j database queries for real sports entities</div>
              <div>• BrightData API calls with real web scraping</div>
              <div>• LinkedIn, Crunchbase, Google News searches</div>
            </div>
            <div>
              <div className="font-semibold text-green-400">✅ Real Results:</div>
              <div>• Actual RFP opportunity analysis</div>
              <div>• Claude AI-powered intelligence reports</div>
              <div>• Real processing time (30-60 seconds)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}