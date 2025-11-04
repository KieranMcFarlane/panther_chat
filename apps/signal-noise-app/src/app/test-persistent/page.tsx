'use client';

import { useEffect, useState } from 'react';

export default function TestPersistentService() {
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, formattedMessage]);
    console.log(formattedMessage);
    
    // Also send to server for debugging
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: formattedMessage })
    }).catch(() => {
      // Ignore errors, just continue
    });
  };

  useEffect(() => {
    addLog('🧪 Test component mounted');
    
    // Test basic environment
    addLog(`🖥️ Window check: ${typeof window !== 'undefined'}`);
    addLog(`🖥️ LocalStorage check: ${typeof localStorage !== 'undefined'}`);
    
    // Test service initialization
    addLog('🔧 Importing PersistentRFPService...');
    
    import('@/services/PersistentRFPService').then(({ default: PersistentRFPService }) => {
      addLog('✅ Service imported successfully');
      
      addLog('🏗️ Getting service instance...');
      const service = PersistentRFPService.getInstance();
      addLog('✅ Service instance obtained');
      
      // Check service state
      const stats = service.getStatistics();
      addLog(`📊 Service state: total=${stats.totalEntities}, processed=${stats.processedEntities}, status=${stats.status}`);
      
      // Test manual initialization
      if (stats.totalEntities === 0) {
        addLog('🔄 Triggering manual entity count initialization...');
        (service as any).reinitializeEntityCount().then(() => {
          const newStats = service.getStatistics();
          addLog(`✅ After manual init: total=${newStats.totalEntities}`);
        }).catch(error => {
          addLog(`❌ Manual init failed: ${error.message}`);
        });
      }
      
    }).catch(error => {
      addLog(`❌ Failed to import service: ${error.message}`);
    });
    
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🧪 Persistent Service Test</h1>
        
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Logs</h2>
          <div className="bg-black rounded p-4 h-96 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500">Waiting for tests...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-green-400">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}