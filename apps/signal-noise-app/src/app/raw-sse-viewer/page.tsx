'use client';

import { useState, useEffect, useRef } from 'react';

export default function RawSSEViewer() {
  const [rawEvents, setRawEvents] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [service, setService] = useState('a2a');
  const [entityLimit, setEntityLimit] = useState(10);
  const eventSourceRef = useRef<EventSource | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startSSEStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setRawEvents([]);
    setIsConnected(true);

    const eventSource = new EventSource(
      `/api/claude-agent-demo/stream?service=${service}&query=Sports%20RFP%20opportunities&mode=batch&entityLimit=${entityLimit}`
    );

    eventSourceRef.current = eventSource;

    // Add raw event listener for ALL events
    eventSource.onmessage = (event) => {
      const timestamp = new Date().toISOString();
      const rawOutput = `event: message\ndata: ${event.data}\n\n`;
      setRawEvents(prev => [...prev, `[${timestamp}] ${rawOutput}`]);
    };

    // Listen for specific event types
    const eventTypes = ['connected', 'log', 'progress', 'heartbeat', 'result', 'completed', 'error'];
    
    eventTypes.forEach(eventType => {
      eventSource.addEventListener(eventType, (event) => {
        const timestamp = new Date().toISOString();
        const rawOutput = `event: ${eventType}\ndata: ${event.data}\n\n`;
        setRawEvents(prev => [...prev, `[${timestamp}] ${rawOutput}`]);
      });
    });

    eventSource.onerror = (error) => {
      const timestamp = new Date().toISOString();
      const errorOutput = `[${timestamp}] ERROR: EventSource connection failed\n${error}\n\n`;
      setRawEvents(prev => [...prev, errorOutput]);
      setIsConnected(false);
    };

    eventSource.onopen = () => {
      const timestamp = new Date().toISOString();
      const openOutput = `[${timestamp}] SSE Connection opened\n\n`;
      setRawEvents(prev => [...prev, openOutput]);
    };
  };

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  const clearOutput = () => {
    setRawEvents([]);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [rawEvents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 font-mono text-sm">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 p-4 border border-green-600 rounded">
          <h1 className="text-xl font-bold text-green-300 mb-4">🔌 Raw SSE Stream Viewer (Curl-like Output)</h1>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-green-300">Service:</label>
              <select 
                value={service} 
                onChange={(e) => setService(e.target.value)}
                className="bg-black border border-green-600 text-green-400 px-2 py-1 rounded"
              >
                <option value="a2a">a2a</option>
                <option value="reliable">reliable</option>
                <option value="headless">headless</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-green-300">Entities:</label>
              <input 
                type="number"
                value={entityLimit}
                onChange={(e) => setEntityLimit(parseInt(e.target.value) || 10)}
                min="1"
                max="50"
                className="bg-black border border-green-600 text-green-400 px-2 py-1 rounded w-20"
              />
            </div>

            <button
              onClick={startSSEStream}
              disabled={isConnected}
              className="bg-green-600 text-black px-4 py-1 rounded hover:bg-green-500 disabled:bg-gray-600"
            >
              {isConnected ? '🔄 Streaming...' : '▶️ Start Stream'}
            </button>

            <button
              onClick={stopStream}
              disabled={!isConnected}
              className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-500 disabled:bg-gray-600"
            >
              ⏹️ Stop
            </button>

            <button
              onClick={clearOutput}
              className="bg-yellow-600 text-black px-4 py-1 rounded hover:bg-yellow-500"
            >
              🗑️ Clear
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-1 rounded ${isConnected ? 'bg-green-600' : 'bg-gray-600'}`}>
              Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
            <span>Events: {rawEvents.length}</span>
            <span className="text-yellow-300">💡 Shows raw SSE output exactly like curl</span>
          </div>
        </div>

        <div className="border border-green-600 rounded">
          <div className="bg-gray-900 px-4 py-2 border-b border-green-600">
            <h2 className="text-green-300 font-bold">Raw SSE Stream Output:</h2>
          </div>
          
          <div 
            ref={containerRef}
            className="h-96 overflow-y-auto p-4 bg-black whitespace-pre-wrap"
            style={{ minHeight: '400px' }}
          >
            {rawEvents.length === 0 ? (
              <div className="text-gray-500">
                Click "Start Stream" to begin receiving raw SSE events...
                
                <div className="mt-4 text-sm">
                  <div className="text-green-300 mb-2">Example curl equivalent:</div>
                  <div className="bg-gray-800 p-2 rounded border border-green-600">
                    curl -N "http://localhost:3005/api/claude-agent-demo/stream?service={service}&query=Sports%20RFP%20opportunities&mode=batch&entityLimit={entityLimit}"
                  </div>
                </div>
              </div>
            ) : (
              rawEvents.map((event, index) => (
                <div key={index} className="mb-2">
                  <span className="text-gray-500">{event}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 p-4 border border-green-600 rounded text-sm">
          <h3 className="text-green-300 font-bold mb-2">📖 Raw SSE Stream Information:</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>Displays raw Server-Sent Events exactly as received</li>
            <li>Shows event types: connected, log, progress, heartbeat, result, completed, error</li>
            <li>Timestamps show when each event was received</li>
            <li>Auto-scrolls to show latest events</li>
            <li>Identical output to: <code className="bg-gray-800 px-1 rounded">curl -N "..."</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}