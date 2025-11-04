'use client';

import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRealtime, mockRealtimeData } from '@/lib/realtime';

export default function RealtimeStatus() {
  const { connectionStatus, simulateMessage } = useRealtime();

  const handleSimulateMessage = () => {
    const generators = [
      mockRealtimeData.generateRFPAlert,
      mockRealtimeData.generateSignalUpdate,
      mockRealtimeData.generateSystemAlert,
      mockRealtimeData.generateCriticalAlert
    ];
    
    const randomGenerator = generators[Math.floor(Math.random() * generators.length)];
    const mockData = randomGenerator();
    
    simulateMessage(mockData.type, mockData.data, mockData.priority);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Connection Status */}
      <Badge 
        variant={connectionStatus.connected ? "default" : "destructive"}
        className="flex items-center gap-1"
      >
        {connectionStatus.connected ? (
          <>
            <Wifi className="h-3 w-3" />
            Live
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Disconnected
            {connectionStatus.attempts > 0 && (
              <span className="ml-1">({connectionStatus.attempts})</span>
            )}
          </>
        )}
      </Badge>

      {/* Demo Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleSimulateMessage}
        className="border-slate-600 bg-slate-700/50 text-white hover:bg-slate-600/50"
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Demo Alert
      </Button>
    </div>
  );
}
