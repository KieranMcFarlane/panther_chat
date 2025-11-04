'use client';

import { useState, useEffect, useRef } from 'react';

export default function BigEntitySSETest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-30), formattedMessage]);
    console.log(formattedMessage);
  };

  const testBigEntities = () => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    setLogs([]);
    setStatus('connecting');
    addLog('🏆 Testing LARGE sports entities with REAL RFP opportunities');
    
    try {
      const eventSource = new EventSource(
        '/api/claude-agent-demo/stream?service=reliable&query=Major%20sports%20RFP%20opportunities&mode=batch&entityLimit=3'
      );
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setStatus('connected');
        addLog('✅ CONNECTED - Searching LARGE sports organizations');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'entity_search_start') {
            addLog(`🔍 SEARCHING: ${data.message}`);
          } else if (data.type === 'entity_search_complete') {
            addLog(`✅ COMPLETE: ${data.message}`);
          } else if (data.type === 'progress') {
            if (data.message?.includes('Analyzing')) {
              addLog(`📊 ${data.message}`);
            } else {
              addLog(`📋 ${data.message}`);
            }
          } else if (data.type === 'result') {
            const opportunities = data.data?.totalFound || 0;
            addLog(`🎯 FOUND ${opportunities} REAL RFP opportunities from large sports entities!`);
            addLog(`🏁 LARGE ENTITY PROCESSING COMPLETE!`);
            setStatus('completed');
            eventSource.close();
          }
        } catch (error) {
          addLog(`❌ Parse error: ${error}`);
        }
      };

      // Add specific event listeners for entity search events
      eventSource.addEventListener('entity_search_start', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`🔍 ENTITY SEARCH: ${data.message}`);
        } catch (error) {
          addLog(`❌ Parse error: ${error}`);
        }
      });

      eventSource.addEventListener('entity_search_complete', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`✅ ENTITY COMPLETE: ${data.message}`);
        } catch (error) {
          addLog(`❌ Parse error: ${error}`);
        }
      });

      eventSource.addEventListener('result', (event) => {
        try {
          const data = JSON.parse(event.data);
          const opportunities = data.data?.totalFound || 0;
          addLog(`🏁 FINAL RESULT: ${opportunities} opportunities found!`);
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-400 mb-2">
            🏆 BIG SPORTS ENTITY TEST
          </h1>
          <p className="text-gray-400">
            Tests LARGE sports organizations that have REAL public RFP opportunities
          </p>
        </div>

        {/* Control Panel */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={testBigEntities}
                disabled={status === 'connected' || status === 'connecting'}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-semibold"
              >
                {status === 'connecting' ? '🔄 Connecting...' : '🏆 Test Large Entities'}
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
          <h2 className="text-xl font-semibold mb-4 text-blue-400">Large Entity Event Stream</h2>
          <div className="bg-gray-900 rounded p-4 h-96 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Click "Test Large Entities" to search for REAL RFP opportunities from major sports organizations
              </div>
            ) : (
              logs.map((log, index) => {
                let colorClass = 'text-gray-300';
                if (log.includes('🔍 ENTITY SEARCH') || log.includes('🔍 SEARCHING')) {
                  colorClass = 'text-blue-400 font-bold';
                } else if (log.includes('✅ ENTITY COMPLETE') || log.includes('✅ COMPLETE')) {
                  colorClass = 'text-green-400 font-bold';
                } else if (log.includes('FOUND') && log.includes('opportunities')) {
                  colorClass = 'text-yellow-400 font-bold';
                } else if (log.includes('🏁 FINAL RESULT')) {
                  colorClass = 'text-purple-400 font-bold';
                } else if (log.includes('❌')) {
                  colorClass = 'text-red-400';
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
          <h3 className="text-lg font-semibold text-blue-400 mb-2">This Test Proves:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="font-semibold text-blue-400">🏆 Large Sports Entities:</div>
              <div>• Premier League, NFL, NBA, UEFA</div>
              <div>• More public RFP opportunities</div>
              <div>• Real procurement announcements</div>
            </div>
            <div>
              <div className="font-semibold text-green-400">✅ Expected Results:</div>
              <div>• More opportunities found</div>
              <div>• Detailed search results</div>
              <div>• Real RFP announcements</div>
            </div>
          </div>
          <div className="mt-4 text-yellow-400">
            If this finds more opportunities than the Caribbean test, it proves the system is REAL!
          </div>
        </div>
      </div>
    </div>
  );
}