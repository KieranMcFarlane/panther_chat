'use client';

import { useState } from 'react';

export default function SSETestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };

  const startSSETest = () => {
    if (isScanning) {
      addLog('⚠️ Test already in progress...');
      return;
    }
    
    setIsScanning(true);
    setLogs([]);
    addLog('🧪 Starting SSE Test - Raw Event Stream');
    
    try {
      const eventSource = new EventSource(
        '/api/claude-agent-demo/stream?service=reliable&query=Test&mode=batch&entityLimit=2'
      );

      eventSource.onopen = () => {
        addLog('✅ SSE connection opened');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`📨 EVENT: ${data.type} - ${data.message || '(no message)'}`);
          
          // Handle specific event types
          if (data.type === 'entity_search_start') {
            addLog(`🔍 STARTING: ${data.message}`);
          } else if (data.type === 'entity_search_complete') {
            addLog(`✅ COMPLETED: ${data.message}`);
          } else if (data.type === 'progress' && data.message?.includes('Starting BrightData search')) {
            addLog(`🔍 STARTING: ${data.message}`);
          } else if (data.type === 'progress' && data.message?.includes('BrightData search completed')) {
            addLog(`✅ COMPLETED: ${data.message}`);
          } else if (data.type === 'heartbeat') {
            addLog(`💓 Heartbeat: ${data.progress || 'alive'}`);
          } else if (data.type === 'progress') {
            addLog(`📊 Progress: ${data.message}`);
          } else if (data.type === 'result') {
            addLog(`🎯 RESULT: ${data.message}`);
          }
        } catch (error) {
          addLog(`❌ Parse error: ${error}`);
          console.error('Parse error:', error);
        }
      };

      eventSource.addEventListener('heartbeat', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`💓 HEARTBEAT: ${data.message}`);
        } catch (error) {
          addLog(`💓 Heartbeat received`);
        }
      });

      eventSource.addEventListener('result', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`🏁 FINAL RESULT: ${JSON.stringify(data, null, 2)}`);
        } catch (error) {
          addLog(`🏁 Final result received`);
        }
        eventSource.close();
        setIsScanning(false);
      });

      eventSource.onerror = (error) => {
        addLog(`❌ SSE Error: ${error}`);
        console.error('SSE Error:', error);
        eventSource.close();
        setIsScanning(false);
      };

      // Auto-close after 3 minutes
      setTimeout(() => {
        if (eventSource.readyState !== 2) {
          addLog('⏰ Test timeout - closing connection');
          eventSource.close();
          setIsScanning(false);
        }
      }, 180000);

    } catch (error) {
      addLog(`❌ Error: ${error}`);
      setIsScanning(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">🧪 SSE Test Page</h1>
        <p className="text-gray-400 mb-8">
          Raw Server-Sent Events test to verify entity processing events are being sent correctly
        </p>

        <div className="mb-6">
          <button
            onClick={startSSETest}
            disabled={isScanning}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold mr-4"
          >
            {isScanning ? '🧪 Testing SSE...' : '🧪 Start SSE Test'}
          </button>
          
          <button
            onClick={clearLogs}
            className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold"
          >
            🗑️ Clear Logs
          </button>
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Live Event Stream</h2>
          <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-500">Click &quot;Start SSE Test&quot; to begin monitoring events...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={log.includes('ERROR') || log.includes('❌') ? 'text-red-400' : 
                  log.includes('✅') || log.includes('🎯') ? 'text-green-400' : 
                  log.includes('🔍') ? 'text-blue-400' : 
                  log.includes('💓') ? 'text-yellow-400' : 'text-gray-300'}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-gray-900 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">Expected Events</h3>
          <div className="text-sm text-gray-400 space-y-1">
            <div>🚀 Starting RFP Intelligence Scan...</div>
            <div>📊 Analyzing X sports entities for RFP opportunities...</div>
            <div>📊 Processing chunk 1/1: [Entity Names]</div>
            <div className="text-blue-400">🔍 Starting BrightData search for: [Entity Name]</div>
            <div className="text-green-400">✅ BrightData search completed for: [Entity Name]</div>
            <div>🔍 Starting BrightData search for: [Next Entity Name]</div>
            <div className="text-green-400">✅ BrightData search completed for: [Next Entity Name]</div>
            <div>💓 Heartbeat events (every 5 seconds)</div>
            <div className="text-green-400">🎯 Final results with analysis</div>
          </div>
        </div>
      </div>
    </div>
  );
}
